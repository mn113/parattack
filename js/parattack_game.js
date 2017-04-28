/***************/
/*! GAME SETUP */
/***************/
/* game states:
1. Menu - used only before game has been started
2. Intro - used for 5 seconds at start of each level
3. Running - in game
4. Between - between levels when overlays are on
5. Paused - when play is paused
6. Over - game over, no lives left, finish up
*/
var game = {	// Holds misc vars
	state: '',
	lastOverlay: '',
	statsShown: false,
	params: {
		paraSpeed:17500,
		bulletSpeed:0.25,
		planeTypes:['blimp','cobra','apache','hind','messerschmitt','mig','tomcat'],
		planeSpeeds:[15000,12000,10000,9000,8000,7000,5000],
		extraBulletsPerKill:[4,6,7,8,10,13,14,3],
		killsNeededPerLevel:[25,25,30,30,35,35,40,666],		// Level 8 continues until death
		maxPlanesPerLevel:[2,2,3,3,4,4,5,5],
		maxParasPerLevel:[1,2,2,3,3,4,4,5],
		maxBullets:8,
		levelIntensities:[0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.666],
		comboPoints:[125,250,500,750],
		planeQuotas: {
			level1:[.30,.25,.20,.15,.05,.05,.00],			// level 1: 100%
			level2:[.27,.23,.20,.16,.07,.05,.02],			// level 2: 100%
			level3:[.24,.21,.19,.17,.09,.06,.04],			// level 3: 100%
			level4:[.21,.19,.19,.18,.11,.07,.05],			// level 4: 100%
			level5:[.17,.17,.18,.20,.13,.08,.07],			// level 5: 100%
			level6:[.14,.15,.17,.21,.15,.10,.08],			// level 6: 100%
			level7:[.08,.13,.16,.23,.17,.12,.09],			// level 7: 100%
			level8:[.05,.10,.15,.25,.20,.15,.10]			// level 8: 100%
		},
		life_thr: 4000,
		nade_thr: 2500
	},
	player: {},
	entities: {		// Holds the sprite objects created and destroyed each level
		activePlanes:[],
		activeParas:[],
		activeBullets:[],
		groundParasL:[], groundParasR:[],
		bunkerParasL:[], bunkerParasR:[],
		pid:1,			// Plane, bullet, man (para) counters
		bid:1,
		mid:1,

		resetAll: function() {
			this.activePlanes = [];
			this.activeParas = [];
			this.activeBullets = [];
			this.groundParasL = [];	this.groundParasR = [];
			this.bunkerParasL = []; this.bunkerParasR = [];
			this.bid = this.pid = this.mid = 1;			// Reset ids
		}
	},
	level: 1,
	levelStats: {}
};

var player = {		// Vars the player takes with him from beginning to end
	lives:3,
	maxLives:5,
	gun: {
		ammo:100,
		savedAmmo:null,
		angle:90,
		defence:3,
		bulletAccLevel:1
	},
	grenades:3,
	maxGrenades:5,
	levelsCompleted:[false,false,false,false,false,false,false,false],
	allKillsThisGame:[0,0,0,0,0,0,0,0],		// NOT USED YET (cumulator -> stats)
	scores: {
		allLevelScores:[],
		spendableScore:0,
		cumulativeScore:0
	}
}

var levelStats = {
	levelTime:0,
	bulletsFired:0,
	hits:0,
	planeKills:0,
	killsNeeded:30,	// Set per level in startLevel(level)
	landedParas:0,
	accuracy: 0,
	comboScore:0,
	comboChain:[],	// Temporarily stores bids which hit planes. Tested for consecutivity with showCombo()
	driveBys:1,
	allKillsThisLevel:[0,0,0,0,0,0,0,0],

	resetAll: function() {
		// reset method to replace code in startLevel() function
	},

	scores: {
		levelBonus:0,
		planeScore:0,
		accuScore:0,
		comboScore:0,
		timeScore:0,
		paraScore:0,
		levelScore:0,

		calcScore: function() {
			this.levelBonus = (player.levelsCompleted[game.level-1] == true) ? 500 : 0;					// gain 500 for beating the level
			var planeScore = 0;
			for (var i in levelStats.allKillsThisLevel) {
				this.planeScore += levelStats.allKillsThisLevel[i]*(1+game.params.extraBulletsPerKill[i]);
			}
			this.accuScore = (!isNaN(levelStats.accuracy)) ? Math.floor(10*levelStats.accuracy) : 0;// score 0 if accuracy invalid
			this.comboScore = levelStats.comboScore;
			this.timeScore = 600 - levelStats.levelTime; 											// finish inside 10 minutes to score points here
			this.paraScore = (levelStats.landedParas == 0) ? 1500 : -25 * levelStats.landedParas;	// bonus for flawless victory
			this.levelScore = (this.levelBonus + this.planeScore + this.accuScore + this.timeScore + this.paraScore);	// Total score for this level

			player.scores.allLevelScores[game.level-1] = this.levelScore;								// Store it in array
			player.scores.spendableScore += this.levelScore;										// Add latest score to cumulator
			player.scores.cumulativeScore += this.levelScore;										// Add latest score to cumulator

			this.checkRewards();
		},

		loadScore: function() {
			var scoreHtml = '<p>Level bonus: '+this.levelBonus+'</p>'+
							'<p>Targets bonus: '+this.planeScore+'</p>'+
							'<p>Accuracy bonus: '+this.accuScore+'</p>'+
							'<p>Combo bonus: '+this.comboScore+'</p>'+
							'<p>Time bonus: '+this.timeScore+'</p><p>'+
							'<p>Ground penalty: '+this.paraScore+'</p>'+
							'<p>Level score: '+this.levelScore+'</p>'+
							'<p>Game score so far: '+player.scores.spendableScore+'</p>';

			if (this.parascore>0) scoreHtml.replace('Ground penalty','Ground bonus');

			return scoreHtml;
		},

		checkRewards: function() {
			var tot = player.scores.cumulativeScore;	// MUST BE SEPARATE FROM SHOP SCORE
			if (tot > game.params.life_thr) {
				player.lives++;
				//updateLives();
				// Show message
				console.log('Gained an extra life for '+game.params.life_thr+' points.')
				game.params.life_thr += 4000;
			}
			if (tot > game.params.nade_thr) {
				player.grenades++;
				//setGrenades();
				// Show message
				console.log('Gained a grenade for '+game.params.nade_thr+' points.')
				game.params.nade_thr += 2500;
			}
		}
	}
}


/**********/
/*! TIMER */
/**********/
var levelTimer = {
	startTime: null,
	stopTime: null,
	elapsed: 0,

	start: function() {
		var tstart = new Date();
		this.startTime = tstart.getTime();
	},

	stop: function() {
		var tstop = new Date();
		this.stopTime = tstop.getTime();
		this.elapsed += Math.floor(0.001*(this.stopTime - this.startTime));		// store what's elapsed so far (in seconds)
		return this.elapsed;
	},

	reset: function() {
		this.elapsed = 0;
	},

	formatTime: function() {
		var e = this.elapsed;		// in seconds
		var h = Math.floor(e/3600);	// number of whole hours (typically 0)
		var r = e%3600;				// remainder in seconds
		var m = Math.floor(r/60);	// number of whole minutes
		var s = e%60;				// number of whole seconds

		if (s<10) s = '0'+s;	// add leading zero

		var timeString = '';
		if (h>0) {
			if (m<10) m = '0'+m;		// add leading zero
			timeString = h+':'+m+':'+s;	// hours, minutes, seconds
		}
		else {
			timeString = m+':'+s;		// minutes, seconds
		}
		return timeString;
	}
}

var options = {
	gfxEnabled: false,
	sfxEnabled: false,
	musicEnabled: false
}


/*! jQuery document.ready() { */
$(function() {	// on document ready:


$('img#title').click(function() {
	$(this).animate({"top":"-=600px"},500, 'linear', function() {
		updateStats();
		showOverlay('menu');
	});
});


/******************/
/*! AJAX OVERLAYS */
/******************/
$.ajaxSetup ({
	cache: true
});

$("#overlay .stats a").live("click", function() {
	console.log($(this));
	$(this).parent.html(levelStats.scores.loadScore());
});

function showOverlay(overlay, type) {
	if (!($('#overlay').is(':visible'))) {
		$('#overlay').show().animate({"top":0}, 500, 'linear');
		//slideDown(800);		// Only animates in if not already visible
	}

	$('#overlay').children().hide()					// Hide all
				 .siblings('#'+overlay).show();		// Show desired

	switch(overlay) {
	case 'menu':
		game.lastOverlay = 'menu';
		game.state = 'menu';
		// set options to last known state?
		break;

	case 'rules':
		// nada
		break;

	case 'paused':
		// add stats?
		break;

	case 'score':
		$("#score .stats").html(levelStats.scores.loadScore());		// DOESN'T WORK
		break;

	case 'shop':
		$('#shop h4 span').html(player.scores.spendableScore);	// Refresh points
		$('#shop h5').html();									// Clear message
		// update shop inventory
		break;

	case 'victory':
		player.levelsCompleted[game.level-1] = true;
		levelStats.scores.calcScore();
		game.lastOverlay = 'victory';
		game.state = 'between';

		if (type == 0) $('#victory h2').html("Victory!");					// Standard h2 heading for victory screen
		else if (type == 1) $('#victory h2').html("Flawless Wicktory!");	// Alternative h2 heading for victory screen

		showStats('victory');
		break;

	case 'gameover':
		game.lastOverlay = 'gameover';

		var msgs = {
			2: 'Paras stormed your bunker :(',
			3: 'With no more ammo, it was only a matter of time...',
			4: 'Cancelled by player'
		}

		$('#gameover h4').html(msgs[type]);		// Insert the reason for loss

		player.lives--;					// Lose 1 life
		updateLives();

		if (player.lives > 0) {
			showStats('gameover');
		}
		else {
			game.state = 'over';
			// GAME OVER! (FOR REAL!)
		}
		break;
	default:
		// whatever
	}
}

function hideOverlay() {
	$('#overlay').animate({"top":"-600px"}, 500, 'linear', function() {
		$(this).hide();
	});
	//slideUp(800).html('');
}

function showStats(overlay) {
	levelStats.accuracy = 100*levelStats.hits/levelStats.bulletsFired;
	levelStats.accuracy = isNaN(levelStats.accuracy) ? 0 : levelStats.accuracy.toFixed(2);

	var statsHtml = '';
	statsHtml += '<div id="scorestats">';
	statsHtml += '<p>Lives remaining: '+player.lives+'</p>';
	statsHtml += '<p>Level time: '+levelTimer.formatTime()+'</p>';
	statsHtml += '<p>Paras landed: '+levelStats.landedParas+'</p>';
	statsHtml += '<p>Bullets fired: '+levelStats.bulletsFired+', Hits: '+levelStats.hits+
				 ', Shooting accuracy: '+levelStats.accuracy+'%</p>';
	statsHtml += '<p>Planes killed: '+levelStats.planeKills+'</p>';
	statsHtml += '<p>Paras killed: '+levelStats.allKillsThisLevel[7]+'</p>';
	// Create planes matrix:
	for (i=0; i<game.params.planeTypes.length; i++) {
		statsHtml += '<div class="scoreplane '+game.params.planeTypes[i]+'"></div>'+
					 '<p class="total">x'+levelStats.allKillsThisLevel[i]+'</p>';
		if (i==3) statsHtml += '<br style="clear:both; margin-bottom:40px;"/>';
	}
	statsHtml += '<div class="scoreplane para"></div><p class="total">x'+levelStats.allKillsThisLevel[7]+'</p>';
	statsHtml += '<br /><br /></div>';

	$('#'+overlay+' .stats').html(statsHtml);	// Display it in the requesting overlay
	game.statsShown = true;

	var successword = (player.levelsCompleted[game.level-1]) ? 'completed' : 'failed';
	console.log('Level '+game.level+' '+successword+'. Bullets fired: '+levelStats.bulletsFired+', Hits: '+levelStats.hits+', Shooting accuracy: '+levelStats.accuracy)+'. Skill: '+assessSkill();
}


/***************/
/*! CLICKABLES */
/***************/
// Function to detect all clicks within #overlay and act upon clicked element's id (Event Delegation -  tasty!)
$('#overlay').click(function(e){
	var clickedID = e.target.id;

	if ($(e.target).hasClass('button')) {
		if (options.sfxEnabled) sounds.click.play();		// CLICK NOT WORKING?

		switch(clickedID) {
		case 'startgame':
			// Process menu selections:
			if (options.sfxEnabled) soundManager.loadSfx();
			if (options.musicEnabled) soundManager.loadMusic();
			if (options.gfxEnabled) swapSprites(2009);
			if (options.sfxEnabled || options.musicEnabled) $('#volumewidget').show();
			startLevel(1);
			break;

		case 'proceed':
			startLevel(game.level+1);
			break;

		case 'retry':
			player.gun.ammo = player.gun.savedAmmo; // Get our saved ammo level back (retrying level)
			updateStats();
			startLevel(game.level);
			break;

		case 'quit':
			window.location.reload();	// Reload the page (restarts game)
			break;

		case 'showrules':
			showOverlay('rules');
			break;

		case 'showscore':
			showOverlay('score');
			break;

		case 'showshop':
			showOverlay('shop');
			break;

		case 'back':
			showOverlay(game.lastOverlay);
			break;

		case 'resume':
			unpause();
			break;

		default:
			// anything?
		}
	}
	else if ($(e.target).hasClass('option') && !($(e.target).hasClass('disabled'))) {	// Radio-esque buttons

		var prefix = clickedID.substr(0,3);				// First part of id, e.g. 'sfx'
		var suffix = clickedID.substr(-2,2);			// Last part, e.g. 'on'
		$('a[id ^= '+prefix+']').removeClass('selected');
		$(e.target).addClass('selected');

		switch(prefix) {
		case 'sfx':
			options.sfxEnabled = (suffix == 'on') ? true : false;
			break;
		case 'mus':
			options.musicEnabled = (suffix == 'on') ? true : false;
			break;
		case 'gfx':
			options.gfxEnabled = (suffix == 'on') ? true : false;
			break;
		}
	}
	return false;	// Whatever it was, don't follow <a href="#">
});

// Non-overlay clicks:
$('#gamefield').click(function(e1) {				// When user mouseclicks the gamefield during play,
	var clickedID = e1.target.id;

	if (game.state == 'running') {
		if (clickedID == 'vol_mute') {
			soundManager.gameMuteToggle();								// Mute SM2
			$(e1.target).toggleClass('muted').toggleClass('unmuted');	// Change icon
		}
		else if (clickedID == 'vol_down') {
			soundManager.setGameVolume(-10);
		}
		else if (clickedID == 'vol_up') {
			soundManager.setGameVolume(+10);
		}
		else {
			$('#tooltip').css("left", e1.pageX)			// Position the hidden tooltip div at the mouse pointer
						 .css("top", e1.pageY)
						 .toggle();						// Turn it on/off
		}
	}
	return false;	// No-follow
});


/*********/
/*! SHOP */
/*********/
$('#shop p a').click(function(e) {	// Each time a 'Buy' button is clicked
	item = $(this).attr("id");		// Get id of clicked button
	shop.buyItem(item);
});

var shop = {
	prices: {
		ammo50: 500,
		ammo100: 900,
		ammo250: 2200,
		grenade: 1750,
		defenceUpgrade: 5000,
		extraLife: 5000,
		bulletAccelerator: 7000,
		hamburger: 20
	},
	quantity: {
		defenceUpgrades: 1,		// Can buy 1 per round, 3 times in total?
		bulletAccelerator: 1
	},

	buyItem: function(item) {		// ITEM NOT BEING PASSED
		var cost = this.prices[item];
		console.log(item+', '+cost);
		if (player.scores.spendableScore < cost) {			// If sufficient funds not available
			this.showMessage("You can't afford that.");
		}
		else {												// Else, buy the item
			switch (item) {
			case 'ammo50':
				player.gun.ammo += 50;
				$('#ammo').html(formatAmmo(player.gun.ammo));
				this.showMessage('You bought 50 ammo.');
				break;
			case 'ammo100':
				player.gun.ammo += 100;
				$('#ammo').html(formatAmmo(player.gun.ammo));
				this.showMessage('You bought 100 ammo.');
				break;
			case 'ammo250':
				player.gun.ammo += 250;
				$('#ammo').html(formatAmmo(player.gun.ammo));
				this.showMessage('You bought 250 ammo.');
				break;
			case 'grenade':
				if (player.grenades < player.maxGrenades) {
					player.grenades++;
					setGrenades();
					this.showMessage('You bought a grenade.');
				}
				break;
			case 'defenceUpgrade':
				$(this).parent.remove();	// Remove the entire line so it can't be bought again
				this.showMessage("You upgraded your gun's defence.");
				player.gun.defence += 1;
				break;
			case 'extraLife':
				if (player.lives < player.maxLives) {
					player.lives++;
					updateLives();
					this.showMessage('You bought an extra life.');
				}
				break;
			case 'bulletAccelerator':
				$(this).parent.remove();	// Remove the entire line so it can't be bought again
				$('#shop h5').html('You bought the Bullet Accelerator. I hope it helps!');
				game.params.bulletSpeed += 0.02;
				player.gun.bulletAccLevel += 1;
				break;
			case 'hamburger':
				this.showMessage("You bought a hamburger. Yum!");
				break;
			}
			// alter shop inventory
			// refresh shop
			player.scores.spendableScore -= cost;					// Pay for item
			$('#shop h4 span').html(player.scores.spendableScore);	// Refresh points
		}
	},

	showMessage: function(string) {
		$('#shop h5').html(string)
					 .slideDown(500)
					 .animate({"opacity":1}, 2000, function() {
					 	$(this).fadeOut(500);
					 });
	}
}


/****************/
/*! SOUND SETUP */
/****************/
var sounds = {		// Empty container for all the sounds to be used
	click: null,		// click.mp3
	planes: {
		introPlane: null,		// biplane.mp3
		blimp: null,			// heli1.mp3
		apache: null,			// heli1.mp3
		cobra: null,			// heli1.mp3
		hind: null,				// heli1.mp3
		messerschmitt: null,	// messerschmitt64.mp3
		mig: null,				// mig.mp3
		tomcat: null			// tomcat.mp3
	},
	bullet: null,	// bullet.mp3
	explosion: null,// boom.mp3
	paraHit1: null,	// aiiee.mp3
	paraHit2: null,	// augh.mp3
	splat1: null,	// splat1.mp3
	splat2: null,	// splat2.mp3
	splatargh: null,	// splatargh.mp3
	dive: null,			// stukadive1sec.mp3
	combo1: null,
	combo2: null,
	grenade: null,
	driveby: null,
	bunkerStorm: null,	// bugle64.mp3
	victory: null,
	gameover: null,
	music: {
		1: null,
		2: null,
		3: null
	}
};

soundManager.url = 'sm2/';
soundManager.debugMode = false;
soundManager.onload = function() {
	// SM2 is ready to go!
	sounds.click = soundManager.createSound({id: 'sfx_click', url: 'sm2/mp3/click.mp3', volume: 50});
	sounds.click.play();
	// Delay loading sfx bundle until player has specified he wants sound
}

soundManager.onerror = function() {
	// SM2 could not start, no sound support, something broke etc. Handle gracefully.
	$('#menu #sfx_on').addClass('disabled');		// Make sound & music unselectable in menu
	$('#menu #music_on').addClass('disabled');
	$('<span class="flasherror">(Flash required for sound - not found)</span>').appendTo('#menu form p:first');
}

soundManager.loadSfx = function() {
	sounds.introPlane = soundManager.createSound({id:'sfx_introPlane', url:'sm2/mp3/biplane.mp3', volume:50});
	sounds.blimp = soundManager.createSound({id:'sfx_blimp', url:'sm2/mp3/heli1.mp3', volume:50});
	sounds.apache = soundManager.createSound({id: 'sfx_apache', url: 'sm2/mp3/heli1.mp3', volume: 50});
	sounds.cobra = soundManager.createSound({id: 'sfx_cobra', url: 'sm2/mp3/heli1.mp3', volume: 50});
	sounds.hind = soundManager.createSound({id: 'sfx_hind', url: 'sm2/mp3/heli1.mp3', volume: 50});
	sounds.messerschmitt = soundManager.createSound({id: 'sfx_messerschmitt', url: 'sm2/mp3/messerschmitt64.mp3', volume: 50});
	sounds.mig = soundManager.createSound({id: 'sfx_mig', url: 'sm2/mp3/mig.mp3', volume: 50});
	sounds.tomcat = soundManager.createSound({id: 'sfx_tomcat', url: 'sm2/mp3/tomcat.mp3', volume: 50});
	sounds.bullet = soundManager.createSound({id: 'sfx_bullet', url: 'sm2/mp3/bullet.mp3', volume: 50});
	sounds.explosion = soundManager.createSound({id: 'sfx_explosion', url: 'sm2/mp3/boom.mp3', volume: 50});
	sounds.paraHit1 = soundManager.createSound({id: 'sfx_parahit1', url: 'sm2/mp3/aiiee.mp3', volume: 50});
	sounds.paraHit2 = soundManager.createSound({id: 'sfx_parahit2', url: 'sm2/mp3/augh.mp3', volume: 50});
	sounds.splat1 = soundManager.createSound({id: 'sfx_splat1', url: 'sm2/mp3/splat1.mp3', volume: 40});
	sounds.splat2 = soundManager.createSound({id: 'sfx_splat2', url: 'sm2/mp3/splat2.mp3', volume: 40});
	sounds.splatargh = soundManager.createSound({id: 'sfx_splatargh', url: 'sm2/mp3/splatargh.mp3', volume: 40});
	sounds.dive = soundManager.createSound({id: 'sfx_dive', url: 'sm2/mp3/stukadive1sec.mp3', volume: 50});
	sounds.bunkerStorm = soundManager.createSound({id: 'sfx_bunkerstorm', url: 'sm2/mp3/bugle.mp3', volume: 50});
}

soundManager.loadMusic = function() {
	// define music here
}

soundManager.gameVolume = 50;

soundManager.setGameVolume = function(incr) {	// Normally -10 or +10
	// Master volume:
	if (this.gameVolume + incr >= 0 && this.gameVolume + incr <= 100) {	// Stay in 0-100 range
		this.gameVolume += incr;

		for (var i in soundManager.soundIDs) {
			var sobj = soundManager.sounds[soundManager.soundIDs[i]];	// Access the sound object from its ID
			sobj.setVolume(sobj.volume + incr);							// Update the sound object's volume
		}
	}
	console.log("Game volume: "+this.gameVolume);
	$('#volumewidget span').html(this.gameVolume);					// Update display
	//$('#vol_mute').css("width",eval(3+(0.25*this.gameVolume)));	// Make the volume icon longer or shorter (15-28px)
}

soundManager.gameMuteToggle = function() {
	if (soundManager.muted) {
		soundManager.unmute();
	}
	else if (!(soundManager.muted)) {
		soundManager.mute();
	}
	console.log("Muted? "+this.muted);
}


$('#volumewidget').hover(function() {
	$(this).stop().animate({"height":"35px","width":"50px"});		// Hover = grow widget
}, function() {
	$(this).stop().animate({"height":"11px","width":"11px"});		// Mouseout = shrink it
});

function swapSprites(year) {		// Takes 1993 or 2009
	var cssfile = 'sprites'+year;

	$('link[@rel*=style][title]').each(function(i) {
		this.disabled = true;													// Disable all stylesheets
		if (this.getAttribute('title') == cssfile) this.disabled = false;		// Enable the desired stylesheet
	});
}


/*************************/
/*! LEVEL-SPECIFIC SETUP */
/*************************/
function startLevel(n) {
	// Prepare the gamefield:
	$('div.overlay').hide();
	$('#killCount').html('');
	// Make new gun (in case destroyed):
	$('#gun').remove();
	$('<div id="gun" class="angle90"></div>').insertBefore('#bunker');
	player.gun.angle = 90;
	setGrenades();
	updateLives();

	// Reset enemies to zero:
	game.entities.resetAll();

	// Set level parameters:
	game.level = n;
	levelStats.killsNeeded = game.params.killsNeededPerLevel[game.level-1];
	levelStats.hits = 0;
	levelStats.planeKills = 0;
	levelStats.allKillsThisLevel = [0,0,0,0,0,0,0,0] ;	// Clear kill counter for the 8 enemy types
	levelStats.comboChain = [];
	levelStats.landedParas = 0;
	levelStats.levelTime = 0;
	levelStats.bulletsFired = 0;
	levelStats.driveBys = (game.level == 8) ? 3 : 1;
	//levelStats.resetAll(); 		// TBD - replaces the above block

	player.gun.savedAmmo = player.gun.ammo; // Save our ammo level for retries

	// Go:
	levelTimer.reset();
	levelIntro(n);
}

function levelIntro(n) {		// Make the biplane fly across screen with level name
	game.state = 'intro';
	if (options.sfxEnabled) sounds.introPlane.play();
	var $biplane = $('<div id="introplane"><span class="level'+n+'"></span></div>');
	$biplane.prependTo('#gamefield')
			.animate({"left":"-250px"}, 5000, 'linear', function() {
				$(this).remove();
				game.state = 'running';
				runGame();	// start the level action!
			});
}


/*******************/
/*! GAME FUNCTIONS */
/*******************/
function pause() {
	levelTimer.stop();
	$('#gamefield div').stop();		// stop everything moving
	soundManager.pauseAll();
	game.state = 'paused';

	// Clear generators & animators
	loops.stopAll();

	//showPaused();
	showOverlay('paused');
	console.log("game paused");
}

function unpause() {
	soundManager.resumeAll();
	game.state = 'running';

	// Restart generators & animators & timer:
	runGame();

	resumeBullets();				// Set everything moving again
	resumePlanes();
	resumeParas();
	// resumeParaWalk();

	console.log("game unpaused");
}

/* Game Over reasons:
1. Killed enough planes
2. Paras stormed bunker
3. Out of ammo
4. User cancelled
*/
function gameOver(reason) {
	levelStats.levelTime = levelTimer.stop();	// Stop the stopwatch (total seconds)
	$('#gamefield div').stop();					// Stop everything moving
	game.state = 'between';
	soundManager.stopAll();

	// Stop the generators:
	loops.stopAll();

	// Clean up gamefield:
	$('div.plane, div.para, div.bullet, div.combo').remove();
	game.entities.activePlanes = [];
	game.entities.activeParas = [];
	game.entities.activeBullets = [];
	game.entities.groundParasL = [];
	game.entities.groundParasR = [];
	game.entities.bunkerParasL = [];
	game.entities.bunkerParasR = [];

	$('div.overlay .stats').html('');	// Clear previous stats
	game.statsShown = false;

	if (reason == 1) {										// reason 1 = victory (reached required kills total)
		type = (levelStats.landedParas == 0) ? 1 : 0;		// victory type 1 = flawless victory (no landings)
		showOverlay('victory', type)
	}
	else {
		showOverlay('gameover', reason)
	}
}

function startNextLevel() {
	game.level++;
	startLevel(game.level);
}


/***********************************/
/*! LOOPS (GENERATORS & ANIMATORS) */
/***********************************/
var loops = {	// Variables used to manage setInterval loops which run game
	collisionLoop: null,
	killsLoop: null,
	planeGen: null,
	paraGen: null,
	paraFall: null,
	paraWalk: null,
	driveByCheck: null,
	cleanup: null,

	runAll: function() {
		this.collisionLoop = setInterval(function() {	// Start collision detection loop
			detectCollisions();
		}, 50);

		this.killsLoop = setInterval(function() {
			if (levelStats.planeKills % 40 == 0) $('#killCount').html();			// Reset kill icons after 40
			if (levelStats.planeKills >= levelStats.killsNeeded) gameOver(1);		// Enough kills to beat the level!
		}, 1000);

		this.planeGen = setInterval(function() {			// Start plane generator
			planeGenerator();
		}, 750);

		this.paraGen = setInterval(function() {				// Start para generator
			paraGenerator();
		}, 2500);

		this.paraFall = setInterval(function() {			// Falling paras animate every second
			animateParas();
		}, 1000);

		this.paraWalk = setInterval(function() {			// Ground paras walk every second
			walkParas();
		}, 1000);

		this.cleanup = setInterval(function() {				// Remove expired objects
			cleanup();
		}, 5000);

		this.driveByCheck = setInterval(function() {		// Make a drive-by occur once per level when the situation is desperate
			var a = (levelStats.driveBys > 0) ? true : false;
			var b = (game.entities.bunkerParasR.length >= 2 || game.entities.bunkerParasL.length >= 2) ? true : false;
			var c = (game.entities.groundParasR.length + game.entities.groundParasL.length > 4 ) ? true : false;
			var d = (Math.random() > 0.8) ? true : false;		// 1 in  5 chance

			if (a && b && c && d) {
				driveBy();
				levelStats.driveBys--;
			}
		}, 10000);	// Try every 10 seconds
	},

	stopAll: function() {
		clearInterval(this.collisionLoop);				// Stop the generators
		clearInterval(this.killsLoop);
		clearInterval(this.planeGen);
		clearInterval(this.paraGen);
		clearInterval(this.paraFall);
		clearInterval(this.paraWalk);
		clearInterval(this.cleanup);
		clearInterval(this.driveByCheck);
	}
}

/*********************/
/*! RUNGAME FUNCTION */
/*********************/
function runGame() {				// All code needed for game running state
	levelTimer.start();				// Start a new game timer from zero
	$('div.overlay').hide();		// (just in case)

	loops.runAll();
}


/********************/
/*! STATS FUNCTIONS */
/********************/
function updateStats() {
	$('#ammo').html(formatAmmo(player.gun.ammo));

	// Print list of planeIDs, bulletIDs & paraIDs for debugging
	var activePlanesString = '';									// empty all the strings
	var activeBulletsString = '';
	var activeAirParasString = '';
	var activeGroundParasString = '';
	var activeBunkerParasString = '';
	for (var i in game.entities.activePlanes) activePlanesString += $(game.entities.activePlanes[i]).attr("id") + ' ';		// build new strings
	for (var i in game.entities.activeBullets) activeBulletsString += $(game.entities.activeBullets[i]).attr("id") + ' ';
	for (var i in game.entities.activeParas) activeAirParasString += $(game.entities.activeParas[i]).attr("id") + ' ';
	for (var i in game.entities.groundParasL) activeGroundParasString += $(game.entities.groundParasL[i]).attr("id") + ' ';
	activeGroundParasString += '~ ';
	for (var i in game.entities.groundParasR) activeGroundParasString += $(game.entities.groundParasR[i]).attr("id") + ' ';
	for (var i in game.entities.bunkerParasL) activeBunkerParasString += $(game.entities.bunkerParasL[i]).attr("id") + ' ';
	activeBunkerParasString += '~ ';
	for (var i in game.entities.bunkerParasR) activeBunkerParasString += $(game.entities.bunkerParasR[i]).attr("id") + ' ';
	$('#activePlanes').html(activePlanesString);																	// display the strings
	$('#activeBullets').html(activeBulletsString);
	$('#activeAirParas').html(activeAirParasString);
	$('#activeGroundParas').html(activeGroundParasString);
	$('#activeBunkerParas').html(activeBunkerParasString);
}

function setGrenades() {
	$('#grenadestock .gr').remove();						// Clear grenade display
	for (var i=0; i<player.grenades; i++) {
		$('<div class="gr"></div>').appendTo('#grenadestock');	// Add in the current number remaining
	}
}

function updateLives() {
	$('#lives').html('');										// Clear lives display
	for (var i=0; i<player.lives; i++) {
		$('<div class="heart"></div>').appendTo('#lives');		// Add in the current number remaining
	}
}

function assessSkill() {
	var playerSkill = 0;						// Only last level contributes to skill
	playerSkill += (player.lives-3)*0.02				// 3 lives left: no effect
	playerSkill += (levelStats.accuracy-15)*0.0075;		// 15% accuracy threshold: score 25, +0.075
	playerSkill += (player.gun.ammo < 100) ? -0.05 : 0;	// if ammo under 100, lose 0.05
	playerSkill -= levelStats.landedParas*0.01;			// 5 paras landed: -0.05
	playerSkill += (player.grenades-3)*0.005;			// Use your grenades, skill decreases
	playerSkill += (1.2 - (levelStats.allKillsThisLevel[7]/(levelStats.planeKills + 1)))*0.05;	// Para/plane ratio above 1.2, lose skill
	console.log("Player's total skill: "+playerSkill);

	if (player.levelsCompleted[game.level-1] = true) { 	// If player victorious,
		var levelToTweak = game.level;					// Tweak next level
	}
	else {											// If defeated,
		var levelToTweak = game.level-1				// Tweak this level
	}
	game.params.levelIntensities[levelToTweak] *= (1+playerSkill);	// Tweak intensity (difficulty) for the level to be played
	return playerSkill;
}


/******************/
/*! GUN FUNCTIONS */
/******************/
function formatAmmo(ammo) {
	var ammoString = '';
	if (ammo<1000) ammoString += '0';
	if (ammo<100) ammoString += '0';
	if (ammo<10) ammoString += '0';
	ammoString += ammo;

	if (ammo < 10) $('#ammo').addClass('low');
	else $('#ammo').removeClass('low');

	return ammoString; // formatted as 4-character number string e.g. '0001'
}

function testAmmo() {
	if (player.gun.ammo == 0) {
		setTimeout(function() {
				// If ammo still zero after 5 seconds, and all moving bullets gone, assume all hope is lost:
				if (player.gun.ammo == 0 && game.entities.activeBullets.length == 0) {
					gameOver(3);
				}
		}, 5000);
	}
}


function updateGunAngle(increment) {
	if (player.gun.angle + increment >= 0 && player.gun.angle + increment <= 180) {	// stay within bounds of 15 - 165 degrees
		player.gun.angle += increment;
	}

	var $gun = $('#gun');		// select gun
	$gun.removeClass();		// remove all gun's classes
	if (player.gun.angle>=0 && player.gun.angle<7.5) $gun.addClass('angle0');
	else if (player.gun.angle>=7.5 && player.gun.angle<22.5) $gun.addClass('angle15');
	else if (player.gun.angle>=22.5 && player.gun.angle<37.5) $gun.addClass('angle30');
	else if (player.gun.angle>=37.5 && player.gun.angle<52.5) $gun.addClass('angle45');
	else if (player.gun.angle>=52.5 && player.gun.angle<67.5) $gun.addClass('angle60');
	else if (player.gun.angle>=67.5 && player.gun.angle<82.5) $gun.addClass('angle75');
	else if (player.gun.angle>=82.5 && player.gun.angle<97.5) $gun.addClass('angle90');
	else if (player.gun.angle>=97.5 && player.gun.angle<112.5) $gun.addClass('angle105');
	else if (player.gun.angle>=112.5 && player.gun.angle<127.5) $gun.addClass('angle120');
	else if (player.gun.angle>=127.5 && player.gun.angle<142.5) $gun.addClass('angle135');
	else if (player.gun.angle>=142.5 && player.gun.angle<157.5) $gun.addClass('angle150');
	else if (player.gun.angle>=157.5 && player.gun.angle<=165.0) $gun.addClass('angle165');
	else if (player.gun.angle>=172.5 && player.gun.angle<=180.0) $gun.addClass('angle180');
	else $gun.addClass('angle90');

	findTarget();
	updateStats();
}

function findTarget(gunAngle) {
	var XTarget = Math.round(400 + (548 * Math.tan((gunAngle-90)*Math.PI/180)));		// calculate target x-coord
	return XTarget;
}

function explodeGun() {
	if (options.sfxEnabled) sounds.explosion.play();
	game.state = '';									// Disable key input
	$('#gun').removeClass()
		     .animate({"left":"-=12px"}, 1)			// Shift left to accommodate explosion sprite
			 .fadeOut(2000, function() {			// Fade out (takes longer than explode animation)
					gameOver(2);
			 });
	explode($('#gun'));
}


/*********************/
/*! BULLET FUNCTIONS */
/*********************/
function newBullet() {
	if (game.entities.activeBullets.length < game.params.maxBullets) {	// room for another bullet?
		var bulletID = 'bullet' + game.entities.bid;						// e.g. "bullet33"

		var $bullet = $('<div id="'+ bulletID +'"></div>')	// Create bullet element
					.addClass('bullet')
					.data("bid",game.entities.bid)
					.appendTo('#gamefield');				// Add bullet to document
		game.entities.activeBullets.push($bullet);				// Register bullet
		game.entities.bid++;

		// Shoot the bullet:
		var XTarget = findTarget(player.gun.angle);
		var bulletTime = (548/Math.abs(Math.cos((player.gun.angle-90)*Math.PI/180)))/game.params.bulletSpeed;	// Bullet animation time = distance over speed

		$bullet.data("XTarget", XTarget)												// Attach its target info
			   .data("bulletTime", bulletTime)											// Attach its total travel time
			   .data("hits",0)
			   .animate({"top":"0","left":XTarget}, bulletTime, "linear", function() {	// Move the bullet
					$(this).remove();													// When anim finishes, remove bullet
					deregisterBullet(this);
			   });

		if (options.sfxEnabled) sounds.bullet.play();
		levelStats.bulletsFired++;
		player.gun.ammo--;
		testAmmo();		// Check if ammo stuck on zero
		updateStats();
	}
}

function deregisterBullet($bullet) {
	for (var key in game.entities.activeBullets) {					// find our expired bullet's index
		if (game.entities.activeBullets[key] == $bullet) break;		// WHY DOES THIS MATCH AND NOT FOR PLANES?
	}
	game.entities.activeBullets.splice(key,1);							// remove the expired bullet
	updateStats();
}

function resumeBullets() {					// Restart bullets on unpause
	for (var i in game.entities.activeBullets) {
		var $bullet = $(game.entities.activeBullets[i]);	// Get bullet from DOM
		var XTarget = $bullet.data("XTarget");		// Read its target
		var y = parseInt($bullet.css("top"));		// Read its y-coord
		var oldTime = $bullet.data("bulletTime");	// Read its old travel time
		var newTime = oldTime * y/548;				// Calculate the new travel time

		$bullet.animate({"top":"0","left":XTarget}, newTime, "linear", function() {	// Re-animate the bullet
			$(this).remove();														// When anim finishes, remove bullet
			deregisterBullet(this);
		});
	}
}

function showCombo(x,y,hits) {
	$('.combo').remove();								// Clear all previous combo icons
	var points = game.params.comboPoints[(hits-1)%4];	// 125, 250, 500 or 750
	var $comboHtml = $('<div class="combo"></div>');
	$comboHtml.addClass('p'+points)
			  .prependTo('#gamefield')
			  .css("left",x)
			  .css("top",y+20)
			  .fadeOut(1500);
	levelStats.comboScore += points;
}

function testComboChain(hid) {
	// example comboChain array: (1,2,3) <- 4 comes in
	levelStats.comboChain.push(hid);							// Add the new hitting bullet ID
	var n = levelStats.comboChain.length;							// Array should never be empty except at start of level

	if (n>1) {
		if (levelStats.comboChain[n-1] - levelStats.comboChain[n-2] == 1) {	// If newest bullet makes a consecutive hit,
			var comboSize = n-1;					// Return the new combo length
		}
		else {										// If not consecutive,
			levelStats.comboChain = [];				// Empty the array
			levelStats.comboChain.push(hid);		// Add back in the hitting bullet ID
			var comboSize = 0;						// No combo awarded
		}
	}

	return (comboSize) ? comboSize : 0;				// Return comboSize if valid, or 0
}


/************************/
/*! SLAUGHTER FUNCTIONS */
/************************/

function grenade(side) {
	var target = (side == 'left') ? '-=30px' : '+=30px'; 	// Aim left or right?

	var $nade = $('<div class="grenade"></div>')			// Create the grenade
					.appendTo('#gamefield')					// Add it to document
					.animate({"left":target,"bottom":"+=30px"}, 250, "swing", function() {				// y upwards
		   				$(this).animate({"left":target,"bottom":"18px"}, 200, "swing", function() {		// y downwards
							if (options.sfxEnabled) sounds.explosion.play();
							killGPs($nade.position().left);
							$nade.animate({"left":"-=24px"}, 1, function() {	// shift to accommodate explosion sprite
								explode($nade);
							})
						});
					});
	player.grenades--;
	setGrenades();
	updateStats();
}

function killGPs(groundzero) {
	var groundParas =  game.entities.groundParasR.concat(game.entities.groundParasL)
											.concat(game.entities.bunkerParasR)
											.concat(game.entities.bunkerParasL);
	for (var i in groundParas) {
		var $para = groundParas[i];
		var x = $para.position().left;
		if (x <= groundzero+20 && x >= groundzero-20) {	// If he's in the blast zone,
			console.log($para.attr("id")+" is going home in a plastic bag.");
			$para.remove()
			// Play sound if hit:
			if (options.sfxEnabled) {
				(Math.random() > 0.5) ? sounds.paraHit1.play() : sounds.paraHit2.play();
			}
		}
	}
	rebuildGroundArrays();
	updateStats();
}

// Use this directly after grenade, driveby, plane crash...
function rebuildGroundArrays() {			// After slaughterings, rebuild the 4 arrays from scratch (easier than splicing)
	game.entities.groundParasR = [];				// Clear all the arrays
	game.entities.groundParasL = [];
	game.entities.bunkerParasR = [];
	game.entities.bunkerParasL = [];

	$('#gamefield div.para.ground').each(function() {		// Get every para on the ground
		var idpfx = $(this).attr("id").substr(0,6);
		// Assign him to the correct array:
		if (idpfx == 'bunker' && $(this).hasClass('left')) game.entities.bunkerParasL.push($(this));
		if (idpfx == 'ground' && $(this).hasClass('left')) game.entities.groundParasL.push($(this));
		if (idpfx == 'bunker' && $(this).hasClass('right')) game.entities.bunkerParasR.push($(this));
		if (idpfx == 'ground' && $(this).hasClass('right')) game.entities.groundParasR.push($(this));
	});
	updateStats();
}

function driveBy() {
	var $car = $('<div id="car"></div>').appendTo('#gamefield');			// Create the car
	var allParas = game.entities.groundParasL.concat(game.entities.bunkerParasL)
										.concat(game.entities.bunkerParasR)
										.concat(game.entities.groundParasR);		// All paras to die

	var runOverParas = setInterval(function() {
		for (var i in allParas) {
			var $para = $(allParas[i]);							// Get the para object
			var pos = parseInt($para.css("left"));				// Get the para coord
			var carPos = parseInt($car.css("left"));			// Get the car coord

			if (pos >= carPos && pos <= carPos+38) {		// When collision detected,
					$para.remove();							// The para dies
					console.log($para.attr("id")+' got squished!');
			}
		}
	}, 75);				// when driveBy() is called, run collision detection every 75ms

	console.log("Car start");
	$car.animate({"left":"800px"}, 2000, 'linear', function() {		// Drive the car
		$(this).remove();
		console.log("Car end");
		clearInterval(runOverParas);									// Screen traversed, stop detecting collisions
	});

	rebuildGroundArrays();		// Clears the arrays
}


/********************/
/*! PLANE FUNCTIONS */
/********************/
function newPlane(type) {
	if (game.entities.activePlanes.length < game.params.maxPlanesPerLevel[game.level-1]) {		// room for another plane?
		var planeType = game.params.planeTypes[type];
		var planeSpeed = game.params.planeSpeeds[type];
		var planeID = planeType + game.entities.pid;								// Make a unique id e.g. "blimp12"

		var $plane = $('<div id="'+planeID+'"></div>')						// Create a new plane element
			.addClass('plane')
			.addClass(planeType)											// e.g. "blimp"
			.data("pid", game.entities.pid)										// e.g. 12
			.data("speed", planeSpeed)										// e.g. 4000
			.data("type", type)												// e.g. 0
			.data("planeType", planeType)									// e.g. "blimp"
			.data("ammoBonus", game.params.extraBulletsPerKill[type])		// e.g. 4
			.prependTo('#gamefield');										// Add it to the document
		if (Math.random() > 0.5) {											// Flip it 50% of the time
			$plane.addClass('rtl')
				  .data("dest", "-50px");
		}
		else {
			$plane.addClass('ltr')
				  .data("dest", "800px");
		}
		game.entities.activePlanes.push($plane);									// Register "blimp12" as active
		game.entities.pid++;

		if (options.sfxEnabled) sounds[planeType].play();

		var dest = $plane.data("dest");
		$plane.animate({"left": dest}, planeSpeed, "linear", function() {	// Start it moving
			deregisterPlane($plane);
			$(this).remove();												// When anim finishes, remove it
		});
		updateStats();
	}
}

function deregisterPlane($plane) {
	for (var key in game.entities.activePlanes) {										// Find our expired plane's index
		if ($(game.entities.activePlanes[key]).attr("id") == $plane.attr("id")) break;	// Found it!	// only works matching on IDs
	}
	game.entities.activePlanes.splice(key,1);											// Remove the expired plane

	if (isNaN(key)) {
		console.log("could not find "+$plane.attr("id")+" in array of "+game.entities.activePlanes.length+" active planes to deregister");
	}
	updateStats();
}

function divePlane($plane) {			// Make Messerschmitts dive and crash
	var startx = $plane.position().left;
	if ($plane.hasClass('ltr')) var dest = startx + 350;		// Calculate landing site
	else if ($plane.hasClass('rtl')) var dest = startx - 350;

	var diveLoop = setInterval(function() {			// Detect collisions with airborne paras
		var x = $plane.position().left + 17;		// Use sprite's centre coords
		var y = $plane.position().top + 20;
		for (i in game.entities.activeParas) {
			var $para = game.entities.activeParas[i];
			var a = $para.position().left + 10;
			var b = $para.position().top + 10;
			if (Math.abs(a-x) < 27 && Math.abs(y-b) < 30) {	// Diving plane touches air para
				console.log($para.attr("id")+" became propellor soup thanks to the crashing "+$plane.attr("id"));
				killPara($para);
			}
		}
	}, 100);

	if (options.sfxEnabled) sounds.dive.play(); // Sfx



	$plane.stop(true)	// clearQueue on
		  .addClass('diving')				// Needs to dive from y=60 to y=542
		  .animate({"top":"558px", "left":dest+'px'}, 1000, 'linear', function() {	// Dive
				clearInterval(diveLoop);	// Stop detection of air paras
				killGPs(dest);				// Kill the paras it landed on

				//explode($plane);		// CAUSES FREEZING
				// explode() function duplicated here:	// WASTEFUL!
				if (options.sfxEnabled) sounds.explosion.play();		// BOOM!

				$plane.stop().removeClass('rtl').removeClass('ltr').addClass('exploding').addClass('fr1');

				setTimeout(function() {
					$plane.removeClass('fr1').addClass('fr2');			// Swap sprite after 120
					setTimeout(function() {
						$plane.removeClass('fr2').addClass('fr3');			// Swap sprite after 120
						setTimeout(function() {
							$plane.removeClass('fr3').addClass('fr4');			// Swap sprite after 120
							setTimeout(function() {
								$plane.removeClass('fr4').addClass('fr5');			// Swap sprite after 120
								setTimeout(function() {
									$plane.removeClass('fr5').addClass('fr6');			// Swap sprite after 120
									setTimeout(function() {
										$plane.remove();									// Remove plane after 120
										updateStats();
									}, 120);
								}, 120);
							}, 120);
						}, 120);
					}, 120);
				}, 120);
		  });
}

function explodePlane($plane) {
	if (options.sfxEnabled) {
		//sounds[eval($plane.data("planeType"))].stop();	// Stop the sound of that plane (WHAT IF 2 FLYING?)
		//soundManager.stop(eval('sfx_'+$plane.data("planeType")));	// Stops the sound by soundid
	}

	$plane.stop(true);		// clearQueue enabled	// Stop it

	explode($plane);
}

function explode($obj) {
	if (options.sfxEnabled) sounds.explosion.play();		// BOOM!

	$obj.stop().removeClass('rtl').removeClass('ltr').removeClass('grenade').addClass('exploding').addClass('fr1');

	setTimeout(function() {
		$obj.removeClass('fr1').addClass('fr2');			// Swap sprite after 120
		setTimeout(function() {
			$obj.removeClass('fr2').addClass('fr3');			// Swap sprite after 120
			setTimeout(function() {
				$obj.removeClass('fr3').addClass('fr4');			// Swap sprite after 120
				setTimeout(function() {
					$obj.removeClass('fr4').addClass('fr5');			// Swap sprite after 120
					setTimeout(function() {
						$obj.removeClass('fr5').addClass('fr6');			// Swap sprite after 120
						setTimeout(function() {
							$obj.remove();									// Remove plane after 120
							updateStats();
						}, 120);
					}, 120);
				}, 120);
			}, 120);
		}, 120);
	}, 120);
}

function resumePlanes() {
	for (var i in game.entities.activePlanes) {
		var $plane = $(game.entities.activePlanes[i]);	// Get plane from DOM
		var x = $plane.position().left;				// Get its x-coord
		var speed = $plane.data("speed");			// Read its speed data
		var dest = $plane.data("dest");				// Read its destination

		if ($plane.hasClass('ltr')) {			// Calculate remaining flight time
			newTime = speed * (800-x)/800;
		}
		else if ($plane.hasClass('rtl')) {
			newTime = speed * (x/800);
		}

		$plane.animate({"left": dest}, newTime, 'linear', function() {	// Re-animate the plane
			$plane.remove();
			deregisterPlane($plane);
		});
	}
}


/*******************/
/*! PARA FUNCTIONS */
/*******************/
function newPara($plane) {
	if (game.entities.activeParas.length < game.params.maxParasPerLevel[game.level-1]) {				// room for another para?
		var paraID = 'para' + game.entities.mid;										// Make a unique id e.g. "para1"

		var planeX = $plane.position().left;	// Get plane's coords
		var planeY = $plane.position().top;
		var dropX = planeX + 'px';				// Para's creation coords
		var dropY = (planeY + 15 ) + 'px';

		var $para = $('<div id="'+paraID+'"></div>')		// Create a new para element
				.data("mid", game.entities.mid)
				.addClass('para')
				.addClass('normal')
				.css({"left":dropX, "top":dropY})			// Give para the coords
				.prependTo('#gamefield');					// Add him to the document
		game.entities.activeParas.push($para);					// Register para
		game.entities.mid++;

		if (planeX > 350 && planeX <= 400) {
			$para.animate({"left":"-=50px", "top":"+=50px"}, 3000);	// Drift para out of 100px central channel
		}
		if (planeX > 400 && planeX < 440) {
			$para.animate({"left":"+=50px", "top":"+=50px"}, 3000);
		}
		if (planeX > 790) {
			$para.animate({"left":"-=50px", "top":"+=50px"}, 3000);	// Drift away from screen edges
		}
		if (planeX < 10 || isNaN(planeX)) {
			$para.animate({"left":"+=50px", "top":"+=50px"}, 3000);
		}

		$para.animate({"top":"564px"}, game.params.paraSpeed, "linear", function() {	// Drop him
			paraLand($para);
		});
	}
}

function animateParas() {
	for (i in game.entities.activeParas) {
		var $para = game.entities.activeParas[i];
		$para.toggleClass('alt').toggleClass('normal');
	}
}

function killPara($para) {
	// Sound effect:
	if (options.sfxEnabled) {
		var n = 1 + Math.floor(5*Math.random())	// Integer 1-5
		switch (n) {
			case 1: sounds.paraHit1.play(); break;
			case 2: sounds.paraHit2.play(); break;
			case 3: sounds.splat1.play(); break;
			case 4: sounds.splat2.play(); break;
			case 5: sounds.splatargh.play(); break;
		}
	}

	$para.stop(true)	// clearQueue enabled - terminates any earlier animation and guarantees his removal
		 .removeClass('normal')
		 .removeClass('alt')
		 .addClass('shot1')
		 .animate({"top":"+=2px"}, 200, function() {	// His death animation
			$(this).removeClass('shot1')
				   .addClass('shot2')
		 })
		 .animate({"top":"+=2px"}, 200, function() {
			$(this).remove();
		 });
	updateStats();
}

function deregisterPara($para) {
	for (var key in game.entities.activeParas) {					// find our expired para's index
		if (game.entities.activeParas[key] == $para) break;
	}
	game.entities.activeParas.splice(key,1);						// remove the expired para
	updateStats();
}

function resumeParas() {
	for (var i in game.entities.activeParas) {
		var $para = $(game.entities.activeParas[i]);				// Get para from DOM
		var y = $para.position().top;						// Get his y-coord
		var newSpeed = game.params.paraSpeed * (564-y)/564;	// Calculate new drop time

		$para.animate({"top":"564px"}, newSpeed, 'linear', function() {
			if ($para.position().top == 564) paraLand($para);		// Now he can land
		});
	}
}


/**************************/
/*! GROUND PARA FUNCTIONS */
/**************************/
function paraLand($para) {
	var paraID = $para.attr("id");
	var groundParaID= 'ground' + paraID;		// His new id
	var x = $para.position().left;				// His landing spot

	deregisterPara($para);						// Deregister from paras
	levelStats.landedParas++;

	$para.removeClass('normal')					// Convert para to a groundPara
		   .removeClass('alt')
		   .addClass('ground')
		   .addClass('step1')
		   .attr("id", groundParaID);			// Set his new id

	if (x < 400) {
		$para.addClass('left')					// Set his direction
			   .data("dest","350px");			// And destination
		game.entities.groundParasL.push($para);		// Register him in groundParas array
	}
	else {
		$para.addClass('right')
			   .data("dest","440px");
		game.entities.groundParasR.push($para);
	}
	updateStats();
}

function walkParas() {
	var groundParas = game.entities.groundParasL.concat(game.entities.groundParasR);
	for (var i in groundParas) {
		var $groundPara = groundParas[i];

		var pos = $groundPara.position().left;
		var dest = parseInt($groundPara.data("dest"));

		if (Math.abs(pos - dest) < 2) {						// If he's really close...
			reachBunker($groundPara);						// He's allowed to reach the bunker
		}
		else {												// Else keep walking...
			if($groundPara.hasClass("left")) {										// If he's on the left,
				$groundPara.animate({"left":"+=2px"}, 200, function() {				// Walk right
					   $(this).toggleClass('step1').toggleClass('step2')
				});
			}
			if($groundPara.hasClass("right")) {										// If he's on the right,
				$groundPara.animate({"left":"-=2px"}, 200, function() {				// Walk left
					   $(this).toggleClass('step1').toggleClass('step2')
				});
			}
		}
	}
}

function reachBunker($groundPara) {
	var groundParaID = $groundPara.attr("id");
	var bunkerParaID = groundParaID.replace('ground','bunker');
	$groundPara.attr("id", bunkerParaID);				// Add bunker prefix to his id

	if($groundPara.hasClass("left")) {
		var n = null;
		for (var key in game.entities.groundParasL) {					// Find the groundPara's index
			if (game.entities.groundParasL[key] == $groundPara) n=key;
		}
		game.entities.groundParasL.splice(n,1);							// Remove him from groundParas array

		game.entities.bunkerParasL.push($groundPara);					// Register him as a bunker para (L)
		console.log($groundPara.attr("id") + " arrived at the left bunker");
	}
	else if($groundPara.hasClass("right")) {
		var n = null;
		for (var key in game.entities.groundParasR) {					// Find the groundPara's index
			if (game.entities.groundParasR[key] == $groundPara) n=key;
		}
		game.entities.groundParasR.splice(n,1);							// Remove him from groundParas array

		game.entities.bunkerParasR.push($groundPara);					// Register him as a bunker para (R)
		console.log($groundPara.attr("id") + " arrived at the right bunker");
	}

	$groundPara.addClass("bunker");			// Causes his walk cycle to stop being called

	// Make them line up:
	var bPL = game.entities.bunkerParasL;
	var bPR = game.entities.bunkerParasR;
	for (var i=0, l=bPL.length; i<l; i++) {
		bPL[i].css("left",eval(350-(10*i)) + 'px');		// Each new bunkerPara stands 10px back from previous one
	}
	for (var i=0, l=bPR.length; i<l; i++) {
		bPR[i].css("left",eval(440+(10*i)) + 'px');
	}

	updateStats();

	if (game.entities.bunkerParasL.length >= player.gun.defence) paraBunkerStorm('left');
	if (game.entities.bunkerParasR.length >= player.gun.defence) paraBunkerStorm('right');
}

function paraBunkerStorm(side) {
	// animate paras storming the bunker
	console.log('paras are storming your bunker on the '+side+' side!');
	if (options.sfxEnabled) sounds.bunkerStorm.play();

	if (side=='right') {
		$(game.entities.bunkerParasR[0]).animate({"top":"560px","left":"440px"}, 700, 'linear', function() {
			$(game.entities.bunkerParasR[1]).animate({"top":"542px","left":"440px"}, 800, 'linear', function() {
				$(game.entities.bunkerParasR[2]).animate({"top":"524px","left":"440px"}, 900, 'linear', function() {
					var $bullet = $('<div class="bullet"></div>')
						.css("left","440px")
						.css("top","525px")
						.appendTo('#gamefield')
						.animate({"left":"400px"}, 1000, 'linear', function() {		// Fire a bullet at the gun
							$(this).remove();
							explodeGun();
						});
				});
			});
		});
	}
	else if (side=='left') {
		$(game.entities.bunkerParasL[0]).animate({"top":"560px","left":"350px"}, 700, 'linear', function() {
			$(game.entities.bunkerParasL[1]).animate({"top":"542px","left":"350px"}, 800, 'linear', function() {
				$(game.entities.bunkerParasL[2]).animate({"top":"524px","left":"350px"}, 900, 'linear', function() {
					var $bullet = $('<div class="bullet"></div>')
						.css("left","360px")
						.css("top","525px")
						.appendTo('#gamefield')
						.animate({"left":"400px"}, 1000, 'linear', function() {		// Fire a bullet at the gun
							$(this).remove();
							explodeGun();
						});
				});
			});
		});
	}
}


/***********************************/
/*! CONTINUOUSLY RUNNING FUNCTIONS */
/***********************************/

function planeGenerator() {		// Generate planes randomly, based on quotas & level

	var r = Math.random();
	if (r < game.params.levelIntensities[game.level-1]) {	// 30% to 66% chance we make a new plane this time
		var rn = Math.random();
		var thr = 0;								// Threshold starts at 0

		for (var i in game.params.planeQuotas['level'+game.level]) {	// For each plane's quota:
			thr += game.params.planeQuotas['level'+game.level][i];	// Set threshold for that plane
			if (rn < thr) {										// Test it
				newPlane(i);									// If true, create that plane
				break;											// And stop testing
			}
		}
	}
}

function paraGenerator() {		// Generate paras randomly from active planes

	var r = Math.random();
	if (r < game.params.levelIntensities[game.level-1] && game.entities.activePlanes.length > 0) {		// 30% to 66% chance we release a new para now
		var $plane = game.entities.activePlanes[Math.floor((game.entities.activePlanes.length)*Math.random())];	// Select an active plane at random
		newPara($plane);																// Bombs away!
	}
}

var planesHit = new Array();	// Stores all planes hit, for exploding en masse a bit later

function detectCollisions() {

	// Get each of our bullets one by one:
	for (var i in game.entities.activeBullets) {				// 8 bullets max
		var $bullet = $(game.entities.activeBullets[i]);
		var x = $bullet.position().left;
		var y = $bullet.position().top;

		if (x < 0 || x > 800) {			// Get rid of bullets that already went offscreen (low angle)
			deregisterBullet($bullet);
			$bullet.remove();
			continue;					// Don't test this one but continue testing the rest of the bullets
		}

		// Test against paras first (bullet can pass through them):
		for (var j in game.entities.activeParas) {							// 5 paras max
			var $para = $(game.entities.activeParas[j]);
			var p = $para.position().left;
			var q = $para.position().top;

			if (x-p < 22) {											// Simplistic proximity test
				if ((x>=p-2 && x<=p+22) && (y>=q-2 && y<=q+22)) {	// Bullet inside para coords
					deregisterPara($para);
					killPara($para);
					console.log($para.attr("id")+" was hit by "+$bullet.attr("id")+"!");
					levelStats.hits++;
				 	levelStats.allKillsThisLevel[7]++;						// Count 1 para kill
					player.gun.ammo += game.params.extraBulletsPerKill[7];	// Gain his ammo bonus

					// Combo test:
					if ($bullet.data("hits") > 0) showCombo(x,y, $bullet.data("hits"));	// can be 1,2 or 3 depending on hits
					$bullet.data("hits",($bullet.data("hits")+1));

					break;	// Don't test the other paras against this bullet right now
				}
			}
		}

		// Test against planes only when bullet is in the plane zone:
		if (y < 85) {
			for (var k in game.entities.activePlanes) {							// 5 planes max
				var $plane = $(game.entities.activePlanes[k]);
				var a = $plane.position().left;
				var b = $plane.position().top;

				if (x-a < 50) {											// Simplistic proximity test
					if ((x>=a-2 && x<=a+50) && (y>=b-6 && y<=b+22)) {	// Bullet inside plane coords
						// Update kill stats
						deregisterPlane($plane);		// Deregister plane (no more collision tests)

						if ($plane.data("planeType") == 'messerschmitt') divePlane($plane);
						else explodePlane($plane);

						levelStats.hits++;
						levelStats.planeKills++;
					 	levelStats.allKillsThisLevel[$plane.data("type")]++;	// Count 1 kill
						$('<div class="kill"></div>').appendTo('#killCount');	// Add 1 kill icon to counter
					 	player.gun.ammo += $plane.data("ammoBonus");			// Gain its ammo bonus
						console.log($plane.attr("id")+" was hit by "+$bullet.attr("id")+"! ("+levelStats.planeKills+"k)");
						// CODE STOPS AROUND HERE IN OPERA

						// Combo test:
						var hid = $bullet.data("bid");							// hitID
						var comboSize = testComboChain(hid);					// Test the hitID for combos
						if (comboSize > 0) {showCombo(x,y, comboSize);console.log("COMBOOOO! ("+comboSize+")")};
						if ($bullet.data("hits") > 0) showCombo(x,y, $bullet.data("hits"));

						deregisterBullet($bullet);
						$bullet.remove();				// Disappear the bullet

						break;		// Break out of this bullet's detection cycle if a plane was hit
					}
				}
			}
		}
	}
}

function cleanup() {	// Remove old (frozen?) objects from the screen - bullets, planes, paras(?)
	for (var i in game.entities.activeBullets) {				// Problem: the frozen bullets are no longer registered in this array
		var $bullet = game.entities.activeBullets[i];
		if (game.entities.bid - $bullet.data("bid") > 12) {
			deregisterBullet($bullet);
			$bullet.remove();
		}
	}
	for (var i in game.entities.activePlanes) {
		var $plane = game.entities.activePlanes[i];
		if (game.entities.pid - $plane.data("pid") > game.params.maxPlanesPerLevel[game.level-1] + 2) {	// could give premature removal of slow planes?
			deregisterPlane($plane);
			$plane.remove();
		}
	}
	for (var i in game.entities.activeParas) {
		var $para = game.entities.activeParas[i];
		if (game.entities.mid - $para.data("mid") > game.params.maxParasPerLevel[game.level-1] + 2) {
			deregisterPara($para);
			$para.remove();
		}
	}
}


/**********/
/*! INPUT */
/**********/
// Register keypress events on the whole document
// From: http://www.marcofolio.net/webdesign/advanced_keypress_navigation_with_jquery.html
$(document).keydown(function(e) {			// keydown is Safari-compatible; keypress allows holding a key to send continuous events

	if (game.state == 'running') {		// GAME KEYS - DISABLED WHEN PAUSED, or in MENU, INTRO, ETC

		if (!e.shiftKey && e.keyCode==37 && player.gun.angle >= 7.5) {	// press left arrow
			updateGunAngle(-7.5);
		}
		if (!e.shiftKey && e.keyCode==39 && player.gun.angle <= 172.5) {	// press right arrow
			updateGunAngle(+7.5);
		}
		if (e.shiftKey && e.keyCode==37 && player.gun.angle >= 15) {	// press SHIFT + left arrow
			updateGunAngle(-15);
		}
		if (e.shiftKey && e.keyCode==39 && player.gun.angle <= 165) {	// press SHIFT + right arrow
			updateGunAngle(+15);
		}
		if (e.keyCode==32 && player.gun.ammo > 0) {			// press 'space'
			newBullet();									// fire gun
		}
		if (e.keyCode == 90 && player.grenades > 0) {		// press 'z'
			grenade('left');								// grenade L
		}
		if (e.keyCode == 88 && player.grenades > 0) {		// press 'x'
			grenade('right');								// grenade R
		}
		if (e.keyCode == 81) {								// press 'q'
			gameOver(4);
		}
	}

	if (e.keyCode==80) {									// press 'p'
		if (game.state == 'running') pause();				// pause/unpause
		else if (game.state == 'paused') unpause();
	}

	// Temporary keys (aka CHEATS!)
	if (e.keyCode == 68) {									// press 'd'
		driveBy();
	}
	if (e.keyCode == 75) {									// press 'k'
		levelStats.planeKills += 13;						// gain 13 kills
	}
	if (e.keyCode == 65) {									// press 'a'
		player.gun.ammo += 40;								// extra bullets
	}
	if (e.keyCode == 71) {									// press 'g'
		player.grenades += 1;								// gain 1 grenade
		setGrenades();
	}
	if (e.keyCode == 77) {									// press 'm'
		player.scores.spendableScore += 1000000;			// gain 1000000 points
	}
	$('#keypress').html(e.keyCode);		// Show onscreen
});

}); // End of "document ready" jQuery
