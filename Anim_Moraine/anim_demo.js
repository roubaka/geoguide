var anim = {
	
	'poste29': {	
		
		'go': function() {
			setTimeout(anim.poste29.resizeSvg, 300);
			setTimeout(anim.poste29.restart, 300);
			 

			
		},
		
		'loop': function(){
			var timer = new Date().getTime() - offset;

			var tx = 960/2 - timer/100;
			var ty = 560/2 - timer/100;
			
			
			$('#MatMor')[0].setAttribute('patternTransform', 'translate(' + tx + ', ' + ty + ') rotate(-45)');
		},
		
		'stopAnim': function(){
			clearInterval(interval);
		},
		
			
		'resizeSvg': function(){
			
						
			//Trouve la taille dispo
			
			var availableH = parseInt($(window).height());
			var availableW = parseInt($(window).width())
			

			
			//Definit le ratio
			var height = 560;
			var width = 960;
			var aspect = width / height;
			
			//Si la hauteur dispo * le ratio est plus petite que la largeur dispo
			if(availableH * aspect < (availableW)) {
				
				var resizedHeight = availableH;
				// console.log('avH ' + availableH);
				// console.log('avW ' + availableW);
				
				var resizedWidth = resizedHeight * aspect;
				// console.log('resizedHeight ' + resizedHeight);
				// console.log('resizedWidth' + resizedWidth);
			}
			
			else {
				var resizedWidth = availableW;
				var resizedHeight = resizedWidth / aspect;
			}
			
			
			mainSvg.setAttribute('width',resizedWidth - 10);
			mainSvg.setAttribute('height',resizedHeight - 10);
		},
		
		'restart': function(){
			// console.log('coucouRestart');
			mainSvg.setCurrentTime(0);
			offset = (new Date().getTime());
			interval = setInterval(anim.poste29.loop, 1000/15);
		},
		
		// 'coucou': function(){
// 			console.log('coucouClick');
// 		},	
	}

	  	
};