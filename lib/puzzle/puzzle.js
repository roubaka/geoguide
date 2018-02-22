puzzle = (function(){
    
    var puzzle = {};
        
    var PUZZLE_DIFFICULTY;
    var PUZZLE_HOVER_TINT;

    var _stage;
    var _canvas;
    var _canvas_id;

    var _img;
    var _pieces;
    var _puzzleWidth;
    var _puzzleHeight;
    var _pieceWidth;
    var _pieceHeight;
    var _currentPiece;
    var _currentDropPiece;  

    var _mouse;
    
    var onPuzzleFinished = function(){
        alert('Congratulations!');
    };

    puzzle.make = function(canvas_id, imgsrc, opts){
        var options = opts || {};
        PUZZLE_DIFFICULTY = options.difficulty || 3;
        PUZZLE_HOVER_TINT = options.hovertint || '#aaa';
        onPuzzleFinished = options.onFinished || onPuzzleFinished;
        _canvas_id = canvas_id;
        _img = new Image();
        _img.addEventListener('load', onImage, false);
        _img.src = imgsrc;
    };
    var onImage = function(e){
        _pieceWidth = Math.floor(_img.width / PUZZLE_DIFFICULTY)
        _pieceHeight = Math.floor(_img.height / PUZZLE_DIFFICULTY)
        _puzzleWidth = _pieceWidth * PUZZLE_DIFFICULTY;
        _puzzleHeight = _pieceHeight * PUZZLE_DIFFICULTY;
        setCanvas();
        initPuzzle();
    };
    var setCanvas = function(){
        _canvas = document.getElementById(_canvas_id);
        _stage = _canvas.getContext('2d');
        _canvas.width = _puzzleWidth;
        _canvas.height = _puzzleHeight;
    };
    var initPuzzle = function(){
        _pieces = [];
        _mouse = { x:0, y:0 };
        _currentPiece = null;
        _currentDropPiece = null;
        _stage.drawImage(_img, 0, 0, _puzzleWidth, _puzzleHeight, 0, 0, _puzzleWidth, _puzzleHeight);
        buildPieces();
        shufflePuzzle();
    };
    var buildPieces = function(){
        var i;
        var piece;
        var xPos = 0;
        var yPos = 0;
        for(i = 0;i < PUZZLE_DIFFICULTY * PUZZLE_DIFFICULTY;i++){
            piece = {};
            piece.sx = xPos;
            piece.sy = yPos;
            _pieces.push(piece);
            xPos += _pieceWidth;
            if(xPos >= _puzzleWidth){
                xPos = 0;
                yPos += _pieceHeight;
            }
        }
    };
    var shufflePuzzle = function(){
        _pieces = shuffleArray(_pieces);
        _stage.clearRect(0,0,_puzzleWidth,_puzzleHeight);
        var i;
        var piece;
        var xPos = 0;
        var yPos = 0;
        for(i = 0;i < _pieces.length;i++){
            piece = _pieces[i];
            piece.xPos = xPos;
            piece.yPos = yPos;
            _stage.drawImage(_img, piece.sx, piece.sy, _pieceWidth, _pieceHeight, xPos, yPos, _pieceWidth, _pieceHeight);
            _stage.strokeRect(xPos, yPos, _pieceWidth,_pieceHeight);
            xPos += _pieceWidth;
            if(xPos >= _puzzleWidth){
                xPos = 0;
                yPos += _pieceHeight;
            }
        }
        document.onmousedown = onPuzzleClick;
    };
    var onPuzzleClick = function(e){
        if(e.layerX || e.layerX == 0){
            _mouse.x = e.layerX - _canvas.offsetLeft;
            _mouse.y = e.layerY - _canvas.offsetTop;
        }
        else if(e.offsetX || e.offsetX == 0){
            _mouse.x = e.offsetX - _canvas.offsetLeft;
            _mouse.y = e.offsetY - _canvas.offsetTop;
        }
        _currentPiece = checkPieceClicked();
        if(_currentPiece != null){
            _stage.clearRect(_currentPiece.xPos,_currentPiece.yPos,_pieceWidth,_pieceHeight);
            _stage.save();
            _stage.globalAlpha = .9;
            _stage.drawImage(_img, _currentPiece.sx, _currentPiece.sy, _pieceWidth, _pieceHeight, _mouse.x - (_pieceWidth / 2), _mouse.y - (_pieceHeight / 2), _pieceWidth, _pieceHeight);
            _stage.restore();
            document.onmousemove = updatePuzzle;
            document.onmouseup = pieceDropped;
        }
    };
    var checkPieceClicked = function(){
        var i;
        var piece;
        for(i = 0;i < _pieces.length;i++){
            piece = _pieces[i];
            if(_mouse.x < piece.xPos || _mouse.x > (piece.xPos + _pieceWidth) || _mouse.y < piece.yPos || _mouse.y > (piece.yPos + _pieceHeight)){
                //PIECE NOT HIT
            }
            else{
                return piece;
            }
        }
        return null;
    }
    var updatePuzzle = function(e){
        _currentDropPiece = null;
        if(e.layerX || e.layerX == 0){
            _mouse.x = e.layerX - _canvas.offsetLeft;
            _mouse.y = e.layerY - _canvas.offsetTop;
        }
        else if(e.offsetX || e.offsetX == 0){
            _mouse.x = e.offsetX - _canvas.offsetLeft;
            _mouse.y = e.offsetY - _canvas.offsetTop;
        }
        _stage.clearRect(0,0,_puzzleWidth,_puzzleHeight);
        var i;
        var piece;
        for(i = 0;i < _pieces.length;i++){
            piece = _pieces[i];
            if(piece == _currentPiece){
                continue;
            }
            _stage.drawImage(_img, piece.sx, piece.sy, _pieceWidth, _pieceHeight, piece.xPos, piece.yPos, _pieceWidth, _pieceHeight);
            _stage.strokeRect(piece.xPos, piece.yPos, _pieceWidth,_pieceHeight);
            if(_currentDropPiece == null){
                if(_mouse.x < piece.xPos || _mouse.x > (piece.xPos + _pieceWidth) || _mouse.y < piece.yPos || _mouse.y > (piece.yPos + _pieceHeight)){
                    //NOT OVER
                }
                else{
                    _currentDropPiece = piece;
                    _stage.save();
                    _stage.globalAlpha = .4;
                    _stage.fillStyle = PUZZLE_HOVER_TINT;
                    _stage.fillRect(_currentDropPiece.xPos,_currentDropPiece.yPos,_pieceWidth, _pieceHeight);
                    _stage.restore();
                }
            }
        }
        _stage.save();
        _stage.globalAlpha = .6;
        _stage.drawImage(_img, _currentPiece.sx, _currentPiece.sy, _pieceWidth, _pieceHeight, _mouse.x - (_pieceWidth / 2), _mouse.y - (_pieceHeight / 2), _pieceWidth, _pieceHeight);
        _stage.restore();
        _stage.strokeRect( _mouse.x - (_pieceWidth / 2), _mouse.y - (_pieceHeight / 2), _pieceWidth,_pieceHeight);
    };
    var pieceDropped = function(e){
        document.onmousemove = null;
        document.onmouseup = null;
        if(_currentDropPiece != null){
            var tmp = {xPos:_currentPiece.xPos,yPos:_currentPiece.yPos};
            _currentPiece.xPos = _currentDropPiece.xPos;
            _currentPiece.yPos = _currentDropPiece.yPos;
            _currentDropPiece.xPos = tmp.xPos;
            _currentDropPiece.yPos = tmp.yPos;
        }
        resetPuzzleAndCheckWin();
    };
    var resetPuzzleAndCheckWin = function(){
        _stage.clearRect(0,0,_puzzleWidth,_puzzleHeight);
        var gameWin = true;
        var i;
        var piece;
        for(i = 0;i < _pieces.length;i++){
            piece = _pieces[i];
            _stage.drawImage(_img, piece.sx, piece.sy, _pieceWidth, _pieceHeight, piece.xPos, piece.yPos, _pieceWidth, _pieceHeight);
            _stage.strokeRect(piece.xPos, piece.yPos, _pieceWidth,_pieceHeight);
            if(piece.xPos != piece.sx || piece.yPos != piece.sy){
                gameWin = false;
            }
        }
        if(gameWin){
            setTimeout(gameOver,500);
        }
    };
    var gameOver = function(){
        document.onmousedown = null;
        document.onmousemove = null;
        document.onmouseup = null;
        _stage.drawImage(_img, 0, 0, _puzzleWidth, _puzzleHeight);
        onPuzzleFinished();
    };
    var shuffleArray = function(o){
        for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
    };

    return puzzle;
})();