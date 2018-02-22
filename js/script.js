if (typeof(Geoguide) == 'undefined'){
    window.Geoguide = {};
}

Geoguide.map = null;
Geoguide.list = null;
Geoguide.state = simpleStorage;
Geoguide.stops = {};
Geoguide.bounds = [[46.47, 6.53], [46.58, 6.71]];
Geoguide.minZoom = 13;
Geoguide.maxZoom = 20;
Geoguide.initialView = {location: [46.524, 6.633], zoom: 12};
Geoguide.closestStop = null;

Geoguide.history = {
    trace: [],
    add: function(pageId){
        Geoguide.history.trace.push(pageId);
        Geoguide.history.views.push([pageId, Date.now()]);
    },
    goBack: function(){
        var n = Geoguide.history.trace.length;
        var pageId = 'welcome'; // default return page
        if (n > 1) {
            Geoguide.history.trace.pop();    // current page, forget about it
            pageId = Geoguide.history.trace.pop();      // previous page, remove because it will be added again automatically
        }
        $.mobile.changePage('#'+pageId, {reverse: true});
    },
    views: [],
};


// Frequency of updating the user's current location.
Geoguide.currentLocationUpdateFrequency = 2500;

// Maximum distance within the user is considered to be at a stop.
Geoguide.stopDistanceThreshold = 0.0002;

// Minimum location accuracy the user needs to have to activate stop locations.
// Note: Google Chrome Desktop sets this to 150 meters in emulation mode.
Geoguide.requiredAccuracyThreshold = 150;


// Define representation mode of map:
// classic : we display track and stops
// trackonly : we display only the track and visited stops
// stopsonly : we don't show the track at all
if (typeof(Geoguide.state.get('REPR_MODE')) == 'undefined'){
    Geoguide.state.set('REPR_MODE', 'classic');
}

// If gamified switch has not already set, set it here and now.
// For user testing, this can be set to a random function.
if (typeof(Geoguide.state.get('GM')) == 'undefined'){
    Geoguide.state.set('GM', 1);
    // for a random value:
    //Geoguide.set('GM', Math.floor(Math.random()*2));
    //Geoguide.set('GM-fixed', 1);      // makes sure GM mode does not get reactivated on relaunch
}

// Only keep gamification off if it has been switched off on purpose
// and not by an error. In case of manual switch off, 'GM-fixed' is set.
if (typeof(Geoguide.state.get('GM-fixed')) == 'undefined'){
    Geoguide.state.set('GM', 1);
}

// Store the history of visited stops in order to display only those in
// case of trackonly representation mode
if (typeof(Geoguide.state.get('STOP_HISTORY')) == 'undefined'){
    Geoguide.state.set('STOP_HISTORY', []);
}

Geoguide.generateUUID = function(){
    var d = new Date().getTime();
    if(window.performance && typeof window.performance.now === "function"){
        d += performance.now(); //use high-precision timer if available
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}

if (typeof(Geoguide.state.get('UUID')) == 'undefined'){
    Geoguide.state.set('UUID', Geoguide.generateUUID());
}



Geoguide.log = function(t, data){
  $.ajax({
    type: 'POST',
    url: 'https://geo.naxio.ch/geoguidegm/log.php',
    data: {'t': JSON.stringify(t), 'data': JSON.stringify(data), 'uuid': Geoguide.state.get('UUID')},
    success: function(){},
    dataType: 'text'
  });
}


Geoguide.initMap = function(){
  if (Geoguide.map == null) Geoguide.createMap();
  Geoguide.updateStopsMap();
	Geoguide.map.invalidateSize();
}


Geoguide.createMap = function(){
  Geoguide.map = L.map('mapdiv', {
      maxBounds: Geoguide.bounds,
      minZoom: Geoguide.minZoom,
  }).setView(Geoguide.initialView.location, Geoguide.initialView.zoom);
  L.tileLayer('https://api.mapbox.com/styles/v1/ckaiser/ciu5w9q8y00uv2iolnxc3podo/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiY2thaXNlciIsImEiOiJaS2cxcmVzIn0.IVsFCwYP0dpDlCdpsAGEcQ', {
      maxZoom: Geoguide.maxZoom,
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
  }).addTo(Geoguide.map);

  // Fix the map display
  setTimeout(function(){ Geoguide.map.invalidateSize(); }, 300);
  setTimeout(function(){ Geoguide.map.invalidateSize(); }, 2000);

  Geoguide.map.locate({setView: false});
  Geoguide.map.on('locationfound', Geoguide.onLocationFound);
  Geoguide.map.on('locationerror', Geoguide.onLocationError);

  Geoguide.addTrack();
  Geoguide.addStops();
  Geoguide.addOrientationPoints();
}


Geoguide.initList = function(){
    Geoguide.list = $('#list-content ul');
    Geoguide.addStops();
    Geoguide.updateStopsList();
}



Geoguide.onLocationFound = function(e){
    Geoguide.log('onLocationFound', {pos: e.latlng, acc: e.accuracy});

    if (typeof(Geoguide.locationTrackingInitalized) == 'undefined'){
        Geoguide.locationTrackingInitalized = true;
        Geoguide.onLocationFoundInitial(e);
        return;
    }
    // update current location marker
    Geoguide.currentLocation.marker.setLatLng(e.latlng);
    Geoguide.currentLocation.accuracy.setLatLng(e.latlng);
    Geoguide.currentLocation.accuracy.setRadius(e.accuracy / 2);

    // Check whether the user is at the location of a stop.
    // This only works if the location accuracy is reasonable.
    if (e.accuracy <= Geoguide.requiredAccuracyThreshold) {
        var visitedStops = Geoguide.state.get('visitedStops') || [];
        for (var k in Geoguide.stops){
            if ($.inArray(k, visitedStops) == -1){  // user has not yet visited this stop
                var c = Geoguide.stops[k].geometry.coordinates;
                var d = Math.pow(Math.pow(c[1] - e.latlng.lat, 2) + Math.pow(c[0] - e.latlng.lng, 2), 0.5);
                if (d < Geoguide.stopDistanceThreshold){
                    Geoguide.arrivedAtStop(k);
                }
                var segment = Geoguide.closestTrackSegment(e.latlng);
                var expMode = Geoguide.state.get('EXP_MODE');
                if (expMode != 'none') {
                  var exp_part = segment.properties.segment;
                  var reprMode = expMode.substr(exp_part-2, 1);
                  var modes = {C: 'classic', P: 'stopsonly', T: 'trackonly'};
                  Geoguide.switchToMapRepresentationMode(modes[reprMode]);
                }
            }
        }
    }



    // initiate next location poll
    Geoguide.followUserLocation(Geoguide.currentLocationUpdateFrequency);
};


Geoguide.onLocationFoundInitial = function(e) {
    Geoguide.currentLocation = {location: e};
    var currentLocationIcon = L.icon({
        iconUrl: 'icons/current-location.png',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -35]
    });
    Geoguide.currentLocation.marker = L.marker(e.latlng, { icon: currentLocationIcon });
    Geoguide.currentLocation.marker.addTo(Geoguide.map);
    var radius = e.accuracy / 2;
    Geoguide.currentLocation.accuracy = L.circle(e.latlng, radius);
    Geoguide.currentLocation.accuracy.addTo(Geoguide.map);
    if (Geoguide.locationInBounds(e.latlng, Geoguide.bounds) == false){
        alert("Vous n'êtes pas dans le périmètre du sentier. Nous avons désactivé le mode aventure.");
        Geoguide.setGamification(0, false);
        Geoguide.map.invalidateSize();
    }
    Geoguide.followUserLocation(Geoguide.currentLocationUpdateFrequency);
};


Geoguide.onLocationError = function(e){
    if (typeof(Geoguide.locationTrackingInitalized) == 'undefined'){
        Geoguide.locationTrackingInitalized = true;
        Geoguide.onLocationErrorInitial(e);
    }
};

Geoguide.onLocationErrorInitial = function(e){
    alert('Erreur lors de la détermination de votre position. Nous avons désactivé le mode aventure.');
    Geoguide.setGamification(0, false);
    Geoguide.map.invalidateSize();
};


Geoguide.locationInBounds = function(loc, bnds){
    if (loc.lat < bnds[0][0] || loc.lat > bnds[1][0]) return false;
    if (loc.lng < bnds[0][1] || loc.lng > bnds[1][1]) return false;
    return true;
};


Geoguide.followUserLocation = function(timeout){
    setTimeout(function(){
      Geoguide.map.locate({setView: false});
    }, timeout);
};


Geoguide.closestTrackSegment = function(pt){
  if (typeof(Geoguide.track) == 'undefined') return null;
  var tracks = [];
  for (var k in Geoguide.track._layers){
    tracks.push(Geoguide.track._layers[k].feature);
  }

  var closestTrack = null;
  for (var i=0; i < tracks.length; i++) {
    var d = Geoguide.pointToLineDistance([pt.lng, pt.lat], tracks[i].geometry);
    if (closestTrack == null || d < closestTrack.dist) closestTrack = { track: tracks[i], dist: d };
  }
  return closestTrack.track;
};

Geoguide.pointToLineDistance = function(pt, ln){
  var dist = null;
  for (var i=0; i < ln.length; i++){
    var subln = ln[i];
    for (var j=0; j < subln.length; j++){
      var c = subln[j];
      var d = Math.pow(Math.pow(c[1] - pt[1], 2) + Math.pow(c[0] - pt[0], 2), 0.5);
      if (d < dist) dist = d;
    }
  }
  return dist;
}


Geoguide.addTrack = function(){
    Geoguide.track = L.geoJson(Geoguide.geojson.track, {
        style: { color: '#dd1111', opacity: 0.7, weight: 4 }
    });
    Geoguide.track.addTo(Geoguide.map);
};


Geoguide.addStops = function(){
    if (Object.keys(Geoguide.stops).length > 0) return;
    var feats = Geoguide.geojson.stops.features;
    for (var i=0; i < feats.length; i++){
        var feat = feats[i];
        var k = 'stop' + feat.properties.id;
        Geoguide.stops[k] = { 'properties': feat.properties, 'geometry': feat.geometry };
        var stopIcon = L.icon({
            iconUrl: 'icons/picon_'+feat.properties.id+'.png',
            iconSize: [32, 41],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40]
        });

        // create the marker but do not add it to the map yet.
        var coords = feat.geometry.coordinates;
        Geoguide.stops[k].marker = L.marker([coords[1], coords[0]], { icon: stopIcon });
        Geoguide.addStopEvents(k);
    }
};

Geoguide.addStopEvents = function(stopId){
    Geoguide.stops[stopId].marker.on('click', function(e) {
        $.mobile.changePage('#'+stopId);
    });
};


Geoguide.addOrientationPoints = function(){
    if (typeof(Geoguide.orientationPoints) == 'undefined') Geoguide.orientationPoints = {};
    if (Object.keys(Geoguide.orientationPoints).length > 0) return;
    var feats = Geoguide.geojson.orientation_points.features;
    for (var i=0; i < feats.length; i++){
        var f = feats[i];
        var k = f.properties.id;
        Geoguide.orientationPoints[k] = {};
        var icon = L.icon({
            iconUrl: 'icons/'+f.properties.icon,
            iconSize: [32, 41],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40]
        });
        var coords = f.geometry.coordinates;
        console.log(coords);
        Geoguide.orientationPoints[k].marker = L.marker([coords[1], coords[0]], { icon: icon }).addTo(Geoguide.map);
    }
};


/**
 * Displays the stops on the map and in the list based on the current application
 * state. In the non-gamified version, it always displays all the stops. In the
 * gamified version, it checks which stops have already been visited and shows
 * them on the map and in the list.
 */
Geoguide.updateStops = function(){
    if (Geoguide.map) Geoguide.updateStopsMap();
    if (Geoguide.list) Geoguide.updateStopsList();
}


/**
 * Updates the map according to the representation state.
 * Runs every time the map is shown.
 */
Geoguide.updateStopsMap = function(){
    var repr = Geoguide.state.get('REPR_MODE');
    var visitedStops = Geoguide.state.get('STOP_HISTORY') || [];
    Geoguide.showStopsOnMap(repr, visitedStops);
    if (repr == 'stopsonly') {
      Geoguide.showTracksOnMap(false);
    } else {
      Geoguide.showTracksOnMap(true);
    }
};

Geoguide.showTracksOnMap = function(show){
  if (show) {
    Geoguide.track.addTo(Geoguide.map);
  } else {
    Geoguide.map.removeLayer(Geoguide.track);
  }
};

Geoguide.showStopsOnMap = function(reprMode, visitedStops){
  // reprMode can be one of: classic trackonly stopsonly
  for (var k in Geoguide.stops){
      var f = Geoguide.stops[k];
      var m = f.marker;
      if (reprMode != 'trackonly' || $.inArray(k, visitedStops) > -1){
          // display this marker if not already added
          if (Geoguide.map.hasLayer(m) == false) m.addTo(Geoguide.map);
      } else {
          // remove marker
          Geoguide.map.removeLayer(m);
      }
  }
};


Geoguide.updateStopsList = function(){
    var currentPage = Geoguide.history.trace[Geoguide.history.trace.length-1];
    var repr = Geoguide.state.get('REPR_MODE');
    var visitedStops = Geoguide.state.get('STOP_HISTORY') || [];
    var stopsList = [];
    var stopsThemeList = {};
    for (var i=0; i < Geoguide.geojson.themes.length; i++){
        stopsThemeList[Geoguide.geojson.themes[i]] = [];
    }
    for (var k in Geoguide.stops){
        var f = Geoguide.stops[k];
        if (repr != 'trackonly' || $.inArray(k, visitedStops) > -1){
            // display this marker if not already added
            var stopHtml = '<li><a data-track="true" data-uid="btn_goFromList" href="#'+k+'"><img src="icons/picon_'+f.properties.id+'.png" style="padding: 20px 0 0 30px; width: 34px; height: 43px;"> <br> '+f.properties.name+'</a></li>';
            stopsList.push(stopHtml);
            stopsThemeList[f.properties.theme].push(stopHtml);
        }
    }

    if (currentPage == 'liste') {
        if (stopsList.length > 0){
            var stopsListHtml = stopsList.join('');
            $('#list-content ul').html(stopsListHtml);
            $('#list-content-empty-msg').css('display', 'none');
            $('#list-content ul').listview('refresh');
        } else {
            $('#list-content ul').html('');
            $('#list-content ul').listview('refresh');
            $('#list-content-empty-msg').css('display', 'block');
        }
    }

    for (var i=0; i < Geoguide.geojson.themes.length; i++){
        var theme = Geoguide.geojson.themes[i];
        if (currentPage.substr(-2) == theme) {
            stopsList = stopsThemeList[theme];
            if (stopsList.length > 0){
                var stopsListHtml = stopsList.join('');
                $('#list-'+theme+'-content ul').html(stopsListHtml);
                $('#list-'+theme+'-content-empty-msg').css('display', 'none');
                $('#list-'+theme+'-content ul').listview('refresh');
            } else {
                $('#list-'+theme+'content ul').html('');
                $('#list-'+theme+'content ul').listview('refresh');
                $('#list-'+theme+'content-empty-msg').css('display', 'block');
            }
        }
    }
};


Geoguide.switchToMapRepresentationMode = function(reprMode){
  if (typeof(reprMode) == 'undefined') return;
  Geoguide.state.set('REPR_MODE', reprMode);
  if (Geoguide.map && Geoguide.stops) Geoguide.updateStopsMap();
}


/**
 * The user has arrived at a stop and we now need to take the action
 * to display a message and update the stops accordingly.
 */
Geoguide.arrivedAtStop = function(stopId){
    if (Geoguide.state.get('GM') == 0) return;  // if not gamified, we don't need to do anything
    var visitedStops = Geoguide.state.get('visitedStops') || [];
    visitedStops.push(stopId);
    Geoguide.state.set('visitedStops', visitedStops);      // add stop to local store
    Geoguide.updateStops();
    alert('Vous êtes arrivé au poste ' + Geoguide.stops[stopId].properties.id +': '+Geoguide.stops[stopId].properties.name);
    $.mobile.changePage('#'+stopId);
};


Geoguide.setGamification = function(gmstate, forced){
    var gm = (Geoguide.state.get('GM') == 0);
    var gmf = (typeof(Geoguide.state.get('GM-fixed')) == 'undefined') ? false : Geoguide.state.get('GM-fixed');
    Geoguide.state.set('GM', gmstate);
    Geoguide.state.set('GM-fixed', gmf);
    Geoguide.updateStops();
    if (gmstate){
        $('.gm').css('display', 'block');
        $('.nogm').css('display', 'none');
        $('#repr-mode-div').css('display', 'block');
        $('#exp-mode-div').css('display', 'block');
        Geoguide.state.set('REPR_MODE', $('[name=repr-carte]:checked').attr('id').substr(5));
        Geoguide.state.set('EXP_MODE', $('[name=exp-mode]:checked').attr('id').substr(4));
    } else {
        $('.gm').css('display', 'none');
        $('.nogm').css('display', 'block');
        $('#repr-mode-div').css('display', 'none');
        $('#exp-mode-div').css('display', 'none');
        Geoguide.state.set('REPR_MODE', 'classic');
        Geoguide.state.set('EXP_MODE', 'none');
    }
};

Geoguide.getGamification = function(){
    return Geoguide.state.get('GM') || 0;
}

Geoguide.handleQuestionnaires = function(){
  $('div.questions .qu_btn').on('click', function(e){
      var quizId = $(this).closest('[data-role=page]').attr('id');
      console.log('handle quiz '+quizId);
      var result = ($(this).attr('data-result') == 'true');
      THS = this;
      Geoguide.state.set(quizId, {'answered': true, 'result': result });
      Geoguide.showQuizResult(quizId);
  });
};

Geoguide.showQuizResult = function(quizId){
    $('#'+quizId+' input[data-result=false]').css({'background-color': '#f00', 'opacity': "0.4"});
    $('#'+quizId+' div[data-result=false]').css({'background-color': '#f55'});
    $('#'+quizId+' .qu_btn[data-result=false]').closest('.ui-btn.ui-input-btn').css({'background-color': '#f55'});
    $('#'+quizId+' input[data-result=true]').css({'background-color': '#0f0', 'opacity': "0.4"});
    $('#'+quizId+' div[data-result=true]').css({'background-color': '#595'});
    $('#'+quizId+' .qu_btn[data-result=true]').closest('.ui-btn.ui-input-btn').css({'background-color': '#595'});
    $('#'+quizId+' .reponse').css('display', 'block');
};


$(function() {
    $( ".qu_btn[type=submit], button" )
      .button()
      .click(function( event ) {
        event.preventDefault();
      });
    Geoguide.handleQuestionnaires();

    // Make sure quiz answers are displayed when the user comes on a quiz page
    var pages = $('[data-role=page][id^=quiz-]');
    for (var i=0; i < pages.length; i++){
        $(document).on('pageshow', '#'+pages[i].id, function(){
            var quizId = this.id;
            var res = Geoguide.state.get(quizId) || {'answered': false};
            if (res.answered == true) {
                Geoguide.showQuizResult(quizId);
            }
        });
    }
});


$(document).on('pageshow', function(e){
  $('*[data-track=true]').on('click', function(e){
    Geoguide.log('click', $(e.target).attr('data-uid'));
  });

  Geoguide.log('pageshow', Geoguide.history.views);
});



$(document).on('pageshow', '#map', Geoguide.initMap);

$(document).on('pageshow', '#liste', Geoguide.initList);
for (var i=0; i < Geoguide.geojson.themes.length; i++){
    $(document).on('pageshow', '#theme-'+Geoguide.geojson.themes[i], Geoguide.initList);
}

$(document).on('pageshow', '#autres', function(){
    $('#gm-chk').prop('checked', (Geoguide.getGamification() == 1)).checkboxradio('refresh');
});


// Logic for the puzzle for stop 9 is below
$(document).on('pageshow', '#stop9', function(){
    snapfit.add($('#stop9-puzzle')[0], {space: 20});
    snapfit.admix($('#stop9-puzzle')[0], true);
});


// Update the score board when shown
$(document).on('pageshow', '#score', function(){
    var quizResponseList = [];
    var pages = $('[data-role=page][id^=quiz-]');
    var nquestions = 0, njustes = 0;
    for (var i=0; i < pages.length; i++){
        var quizId = pages[i].id
        var res = Geoguide.state.get(quizId) || {'answered': false};
        if (res.answered == true) {
            quizResponseList.push({id: quizId, result: res.result});
            nquestions += 1;
            if (res.result == true) njustes += 1;
        }
    }
    var sc = $('#score-content');
    if (nquestions == 0) {
        sc.html("<p>Vous n'avez pas encore fait de quiz.<br>Vous trouverez ici les résultats de vos réponses.</p>");
    } else {
        var html = "<p>Votre score:<br><b>"+njustes+" questions justes sur "+nquestions+"</b></p><hr>";
        html += '<div style="text-align: left;">';
        for (var i=0; i < quizResponseList.length; i++){
            var res = quizResponseList[i];
            var pid = parseInt(res.id.replace('quiz-', ''));
            html += "<p><b><a href=\"#"+res.id+"\">Poste " + pid + "</a></b>: ";
            if (res.result){
                html += '<span style="color: #0a0;">Vous avez répondu juste. Féliciations!</span>';
            } else {
                html += '<span style="color: #a00;">Votre réponse n\'était pas tout à fait correcte.</span>';
            }
            html += "</p>";
        }
        html += '</div>';
        sc.html(html);
    }
});

// Initialise the gamification state (display / hide the corresponding elements)
setTimeout(function(){ Geoguide.setGamification(Geoguide.state.get('GM')); }, 1000);


$(document).on('pageshow', '#stop3', function(){
    $(".twentytwenty-container").twentytwenty();
    Geoguide.stop3_swiper = new Swiper('#stop3-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop6', function(){
    Geoguide.stop6_swiper = new Swiper('#stop6-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop7', function(){
    Geoguide.stop7_swiper = new Swiper('#stop7-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop8', function(){
    Geoguide.stop8_swiper = new Swiper('#stop8-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop11', function(){
    Geoguide.stop11_swiper = new Swiper('#stop11-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop12', function(){
    // initialiser le joli scroll
});

$(document).on('pagebeforehide', '#stop12', function(){
  $('#riversound')[0].pause();
});



$(document).on('pageshow', '#stop13', function(){
    Geoguide.stop13_swiper = new Swiper('#stop13-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop20', function(){
    Geoguide.stop20_swiper = new Swiper('#stop20-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop24', function(){
    Geoguide.stop24_swiper = new Swiper('#stop24-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on('pageshow', '#stop29', function(){
    Geoguide.stop29_swiper = new Swiper('#stop29-photos-swiper', {
        speed: 400, spaceBetween: 100, loop: true
    });
});

$(document).on( "pagecontainerbeforeshow", function(e, ui){
    Geoguide.history.add($(ui.toPage).attr('id'));
});


// Initialisation navigation latérale droite
// $( function() {
//   $( "#mypanel.*" ).panel();
// });




//ajout d'une couche geoJSON à  la carte
// $.getJSON('/tracks.geojson', function(data){ //demande le fichier .geojson au serveur, récupère son contenu (data)
//     var couche = L.geoJson(data, { //crée une couche en utilisant ce contenu
//         style: {color: '#aa1111', opacity: 1, weight: 4} //donne un style aux objets vectoriels qui sont définis dans le fichier .geojson
//     });
//     couche.addTo(map); //ajoute cette couche à  la carte
// });
