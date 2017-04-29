/* global $, console */
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

// Game IIFE
var Parattack = (function($) {

	var game = {	// Holds misc vars
		state: '',
		lastOverlay: '',
		statsShown: false,
		volume: 0,
		options: {
			gfxEnabled: false,
			sfxEnabled: true,
			musicEnabled: false
		},
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
		entities: {		// Holds the sprite objects created and destroyed each level
			activePlanes:[],
			activeParas:[],
			activeBullets:[],
			groundParasL:[], groundParasR:[],
			bunkerParasL:[], bunkerParasR:[],
			pid:1,		// plane counter
			bid:1,		// bullet counter
			mid:1,		// man (para) counter
		},
		level: 1,
		levelStats: {
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
			scores: {
				levelBonus:0,
				planeScore:0,
				accuScore:0,
				comboScore:0,
				timeScore:0,
				paraScore:0,
				levelScore:0
			}
		}
	};

	game.entities.resetAll = function() {
		this.activePlanes = [];
		this.activeParas = [];
		this.activeBullets = [];
		this.groundParasL = [];	this.groundParasR = [];
		this.bunkerParasL = []; this.bunkerParasR = [];
		this.bid = this.pid = this.mid = 1;			// Reset ids
	};

	game.levelStats.resetAll = function() {
		// reset method to replace code in startLevel() function
	};

	game.levelStats.scores.calcScore = function() {
		this.levelBonus = (player.levelsCompleted[game.level-1] === true) ? 500 : 0;	// gain 500 for beating the level
		//var planeScore = 0;
		for (var i = 0; i < 7; i++) {
			this.planeScore += game.levelStats.allKillsThisLevel[i]*(1+game.params.extraBulletsPerKill[i]);
		}
		this.accuScore = (!isNaN(game.levelStats.accuracy)) ? Math.floor(10*game.levelStats.accuracy) : 0;// score 0 if accuracy invalid
		this.comboScore = game.levelStats.comboScore;
		this.timeScore = 600 - game.levelStats.levelTime; 											// finish inside 10 minutes to score points here
		this.paraScore = (game.levelStats.landedParas === 0) ? 1500 : -25 * game.levelStats.landedParas;	// bonus for flawless victory
		this.levelScore = (this.levelBonus + this.planeScore + this.accuScore + this.timeScore + this.paraScore);	// Total score for this level

		player.scores.allLevelScores[game.level-1] = this.levelScore;								// Store it in array
		player.scores.spendableScore += this.levelScore;										// Add latest score to cumulator
		player.scores.cumulativeScore += this.levelScore;										// Add latest score to cumulator

		this.checkRewards();
	};

	game.levelStats.scores.loadScore = function() {
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
	};

	game.levelStats.scores.checkRewards = function() {
		var tot = player.scores.cumulativeScore;	// MUST BE SEPARATE FROM SHOP SCORE
		if (tot > game.params.life_thr) {
			player.lives++;
			//updateLives();
			// Show message
			console.log('Gained an extra life for '+game.params.life_thr+' points.');
			game.params.life_thr += 4000;
		}
		if (tot > game.params.nade_thr) {
			player.grenades++;
			//setGrenades();
			// Show message
			console.log('Gained a grenade for '+game.params.nade_thr+' points.');
			game.params.nade_thr += 2500;
		}
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
	};


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
	};


	/******************/
	/*! AJAX OVERLAYS */
	/******************/
	var ui = {
		showOverlay: function(overlay, type) {
			if (!($('#overlay').is(':visible'))) {
				$('#overlay').show().velocity({"top":0}, 500, 'linear');
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
				$("#score .stats").html(game.levelStats.scores.loadScore());		// DOESN'T WORK
				break;

			case 'shop':
				$('#shop h4 span').html(player.scores.spendableScore);	// Refresh points
				$('#shop h5').html();									// Clear message
				// update shop inventory
				break;

			case 'victory':
				player.levelsCompleted[game.level-1] = true;
				game.levelStats.scores.calcScore();
				game.lastOverlay = 'victory';
				game.state = 'between';

				if (type === 0) $('#victory h2').html("Victory!");					// Standard h2 heading for victory screen
				else if (type === 1) $('#victory h2').html("Flawless Wicktory!");	// Alternative h2 heading for victory screen

				ui.showStats('victory');
				break;

			case 'gameover':
				game.lastOverlay = 'gameover';

				var msgs = {
					2: 'Paras stormed your bunker :(',
					3: 'With no more ammo, it was only a matter of time...',
					4: 'Cancelled by player'
				};

				$('#gameover h4').html(msgs[type]);		// Insert the reason for loss

				player.lives--;					// Lose 1 life
				updateLives();

				if (player.lives > 0) {
					ui.showStats('gameover');
				}
				else {
					game.state = 'over';
					// GAME OVER! (FOR REAL!)
				}
				break;
			default:
				// whatever
			}
		},

		hideOverlay: function() {
			$('#overlay').velocity({"top":"-600px"}, 500, 'linear', function() {
				$(this).hide();
			});
			//slideUp(800).html('');
		},

		showStats: function(overlay) {
			game.levelStats.accuracy = 100*game.levelStats.hits/game.levelStats.bulletsFired;
			game.levelStats.accuracy = isNaN(game.levelStats.accuracy) ? 0 : game.levelStats.accuracy.toFixed(2);

			var statsHtml = '';
			statsHtml += '<div id="scorestats">';
			statsHtml += '<p>Lives remaining: '+player.lives+'</p>';
			statsHtml += '<p>Level time: '+levelTimer.formatTime()+'</p>';
			statsHtml += '<p>Paras landed: '+game.levelStats.landedParas+'</p>';
			statsHtml += '<p>Bullets fired: '+game.levelStats.bulletsFired+', Hits: '+game.levelStats.hits+
						 ', Shooting accuracy: '+game.levelStats.accuracy+'%</p>';
			statsHtml += '<p>Planes killed: '+game.levelStats.planeKills+'</p>';
			statsHtml += '<p>Paras killed: '+game.levelStats.allKillsThisLevel[7]+'</p>';
			// Create planes matrix:
			for (var i = 0; i < game.params.planeTypes.length; i++) {
				statsHtml += '<div class="scoreplane '+game.params.planeTypes[i]+'"></div>'+
							 '<p class="total">x'+game.levelStats.allKillsThisLevel[i]+'</p>';
				if (i === 3) statsHtml += '<br style="clear:both; margin-bottom:40px;"/>';
			}
			statsHtml += '<div class="scoreplane para"></div><p class="total">x'+game.levelStats.allKillsThisLevel[7]+'</p>';
			statsHtml += '<br /><br /></div>';

			$('#'+overlay+' .stats').html(statsHtml);	// Display it in the requesting overlay
			game.statsShown = true;

			var successword = (player.levelsCompleted[game.level-1]) ? 'completed' : 'failed';
			console.log('Level '+game.level+' '+successword+'. Bullets fired: '+game.levelStats.bulletsFired+', Hits: '+game.levelStats.hits+', Shooting accuracy: '+game.levelStats.accuracy+'. Skill: '+assessSkill());
		}
	};


	/*******************/
	/*! GRAPHICS SETUP */
	/*******************/
	function swapSprites(year) {		// Takes 1993 or 2009
		var cssfile = 'sprites'+year;

		$('link[rel*=style][title]').each(function() {
			this.disabled = true;													// Disable all stylesheets
			if (this.getAttribute('title') === cssfile) this.disabled = false;		// Enable the desired stylesheet
		});
	}


	/****************/
	/*! SOUND SETUP */
	/****************/
	var sounds = {		// Empty container for all the sounds to be used
		click: {url: 'sm2/mp3/click.mp3', volume: 50},
		introPlane: {url:'sm2/mp3/planes/biplane.mp3', volume:50},
		blimp: {url:'sm2/mp3/planes/heli1.mp3', volume:80},
		apache: {url: 'sm2/mp3/planes/chopper.mp3', volume: 50},
		cobra: {url: 'sm2/mp3/planes/seaking64.mp3', volume: 50},
		hind: {url: 'sm2/mp3/planes/hovercopter.mp3', volume: 50},
		messerschmitt: {url: 'sm2/mp3/planes/messerschmitt64.mp3', volume: 50},
		mig: {url: 'sm2/mp3/planes/mig.mp3', volume: 50},
		tomcat: {url: 'sm2/mp3/planes/tomcat.mp3', volume: 50},
		dive: {url: 'sm2/mp3/planes/stukadive1sec.mp3', volume: 50},
		bullet: {url: 'sm2/mp3/bullet64.mp3', volume: 50},
		combo1: {url: 'sm2/mp3/combo1.mp3', volume: 40},
		combo2: {url: 'sm2/mp3/combo2.mp3', volume: 40},
		explosion: {url: 'sm2/mp3/boom64.mp3', volume: 50},
		explosion2: {url: 'sm2/mp3/fireball.mp3', volume: 50},
		paraHit1: {url: 'sm2/mp3/human/aiiee64.mp3', volume: 50},
		paraHit2: {url: 'sm2/mp3/human/augh64.mp3', volume: 50},
		splat1: {url: 'sm2/mp3/human/splat1.mp3', volume: 40},
		splat2: {url: 'sm2/mp3/human/splat2.mp3', volume: 40},
		splatargh: {url: 'sm2/mp3/human/splatargh.mp3', volume: 40},
		grenade: {url: 'sm2/mp3/human/fire_in_the_hole.ogg', volume: 50},
		driveby: {url: 'sm2/mp3/car_driveby.mp3', volume: 50, start: 2},
		bunkerStorm: {url: 'sm2/mp3/bugle64.mp3', volume: 50},
		victory: {url: 'sm2/mp3/music/BrassVictory.mp3', volume: 50},
		gameover: {url: 'sm2/mp3/loss.mp3', volume: 50},
		music1: {url: 'sm2/mp3/music/musical078.mp3', volume: 50},
		music2: {url: 'sm2/mp3/music/HeroicDemise.mp3', volume: 50}
	};

	var activeSounds = [];

	function adjustGameVolume(incr) {	// Normally -10 or +10
		// Master volume:
		if (game.volume + incr >= -50 && game.volume + incr <= 50) {	// Stay in -+50 range
			game.volume += incr;
		}
		console.log("Game volume:", game.volume);
		$('#volumewidget span').html(game.volume);					// Update display
		$('#vol_mute').css("width", 15+(0.2*game.volume)+"px");	// Make the volume icon longer or shorter (15-28px)
	}

	function gameMuteToggle() {
		game.options.sfxEnabled = !game.options.sfxEnabled;		//FIXME: better to set to 0, than disable playing?
	}

	function playSound(sound) {
		if (!game.options.sfxEnabled) return;
		var snd = new Audio(sounds[sound].url); 	// Audio buffers automatically when created
		activeSounds.push(snd);					// store it for later access
		snd.volume = (game.volume + sounds[sound].volume) / 100;
		snd.currentTime = sounds[sound].start || 0;
		snd.play();
	}

	function pauseAllSounds() {
		for (var sound of activeSounds) {
			if (!sound.ended && !sound.paused) sound.pause();
		}
	}

	function unpauseAllSounds() {
		for (var sound of activeSounds) {
			if (!sound.ended && sound.paused) sound.play();
		}
	}


	/*********/
	/*! SHOP */
	/*********/
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
		}
	};

	shop.buyItem = function(item) {		// ITEM NOT BEING PASSED FIXME
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
	};

	shop.showMessage = function(string) {
		$('#shop h5').html(string)
					 .slideDown(500)
					 .velocity({"opacity":1}, 2000, function() {
					 	$(this).fadeOut(500);
					 });
	};


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
		game.levelStats.killsNeeded = game.params.killsNeededPerLevel[game.level-1];
		game.levelStats.hits = 0;
		game.levelStats.planeKills = 0;
		game.levelStats.allKillsThisLevel = [0,0,0,0,0,0,0,0] ;	// Clear kill counter for the 8 enemy types
		game.levelStats.comboChain = [];
		game.levelStats.landedParas = 0;
		game.levelStats.levelTime = 0;
		game.levelStats.bulletsFired = 0;
		game.levelStats.driveBys = (game.level === 8) ? 3 : 1;
		//game.levelStats.resetAll(); 		// TBD - replaces the above block

		player.gun.savedAmmo = player.gun.ammo; // Save our ammo level for retries

		// Go:
		levelTimer.reset();
		levelIntro(n);
	}

	function levelIntro(n) {		// Make the biplane fly across screen with level name
		game.state = 'intro';
		playSound('introPlane');
		var $biplane = $('<div id="introplane"><span class="level'+n+'"></span></div>');
		$biplane.prependTo('#gamefield')
				.velocity({"left":"-250px"}, 5000, 'linear', function() {
					$(this).remove();
					game.state = 'running';
					runGame();	// start the level action!
				});
	}


	/*******************/
	/*! GAME FUNCTIONS */
	/*******************/
	function runGame() {				// All code needed for game running state
		levelTimer.start();				// Start a new game timer from zero
		$('div.overlay').hide();		// (just in case)
		loops.runAll();
	}

	function pause() {
		levelTimer.stop();
		$('#gamefield div').velocity('stop');		// stop everything moving
		pauseAllSounds();
		game.state = 'paused';

		// Clear generators & animators
		loops.stopAll();

		//showPaused();
		ui.showOverlay('paused');
		console.log("game paused");
	}

	function unpause() {
		unpauseAllSounds();
		game.state = 'running';

		// Restart generators & animators & timer:
		runGame();

		// Set everything moving again:
		resumeBullets();
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
		game.levelStats.levelTime = levelTimer.stop();	// Stop the stopwatch (total seconds)
		$('#gamefield div').velocity('stop', true);			// Stop everything moving
		game.state = 'between';
		//sm2.stopAll();

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

		if (reason === 1) {										// reason 1 = victory (reached required kills total)
			var type = (game.levelStats.landedParas === 0) ? 1 : 0;		// victory type 1 = flawless victory (no landings)
			playSound('victory');
			ui.showOverlay('victory', type);
		}
		else {
			playSound('gameover');
			ui.showOverlay('gameover', reason);
		}
	}


	/********************/
	/*! STATS FUNCTIONS */
	/********************/
	function updateStats() {
		$('#ammo').html(formatAmmo(player.gun.ammo));

		// Print list of planeIDs, bulletIDs & paraIDs for debugging
		// Empty all the strings:
		var activePlanesString = '';
		var activeBulletsString = '';
		var activeAirParasString = '';
		var activeGroundParasString = '';
		var activeBunkerParasString = '';
		// Build new strings:
		for (var $plane of game.entities.activePlanes) activePlanesString += $plane.attr("id") + ' ';
		for (var $bullet of game.entities.activeBullets) activeBulletsString += $bullet.attr("id") + ' ';
		for (var $airPara of game.entities.activeParas) activeAirParasString += $airPara.attr("id") + ' ';
		for (var $gParaL of game.entities.groundParasL) activeGroundParasString += $gParaL.attr("id") + ' ';
		activeGroundParasString += '~ ';
		for (var $gParaR of game.entities.groundParasR) activeGroundParasString += $gParaR.attr("id") + ' ';
		for (var $bParaL of game.entities.bunkerParasL) activeBunkerParasString += $bParaL.attr("id") + ' ';
		activeBunkerParasString += '~ ';
		for (var $bParaR of game.entities.bunkerParasR) activeBunkerParasString += $bParaR.attr("id") + ' ';
		$('#activePlanes').html(activePlanesString);
		// Display the strings:
		$('#activeBullets').html(activeBulletsString);
		$('#activeAirParas').html(activeAirParasString);
		$('#activeGroundParas').html(activeGroundParasString);
		$('#activeBunkerParas').html(activeBunkerParasString);
	}

	function setGrenades() {
		// Clear grenades display, then add back correct number:
		$('#grenadestock .gr').remove();
		for (var i = 0; i < player.grenades; i++) {
			$('<div class="gr"></div>').appendTo('#grenadestock');
		}
	}

	function updateLives() {
		// Clear lives display, then add back correct number:
		$('#lives').html('');
		for (var i = 0; i < player.lives; i++) {
			$('<div class="heart"></div>').appendTo('#lives');
		}
	}

	function assessSkill() {
		var levelToTweak,
			playerSkill = 0;						// Only last level contributes to skill
		playerSkill += (player.lives-3)*0.02;				// 3 lives left: no effect
		playerSkill += (game.levelStats.accuracy-15)*0.0075;		// 15% accuracy threshold: score 25, +0.075
		playerSkill += (player.gun.ammo < 100) ? -0.05 : 0;	// if ammo under 100, lose 0.05
		playerSkill -= game.levelStats.landedParas*0.01;			// 5 paras landed: -0.05
		playerSkill += (player.grenades-3)*0.005;			// Use your grenades, skill decreases
		playerSkill += (1.2 - (game.levelStats.allKillsThisLevel[7]/(game.levelStats.planeKills + 1)))*0.05;	// Para/plane ratio above 1.2, lose skill
		console.log("Player's total skill: "+playerSkill);

		if (player.levelsCompleted[game.level-1]) { 	// If player victorious,
			levelToTweak = game.level;					// Tweak next level
		}
		else {											// If defeated,
			levelToTweak = game.level-1;				// Tweak this level
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

	function testAmmoDepletion() {
		if (player.gun.ammo === 0) {
			setTimeout(function() {
					// If ammo still zero after 5 seconds, and all moving bullets gone, assume all hope is lost:
					if (player.gun.ammo === 0 && game.entities.activeBullets.length === 0) {
						gameOver(3);
					}
			}, 5000);
		}
	}

	function updateGunAngle(increment) {
		if (player.gun.angle + increment >= 0 && player.gun.angle + increment <= 180) {		// stay within bounds of 15 - 165 degrees
			player.gun.angle += increment;
		}

		var $gun = $('#gun');
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
		if (gunAngle === 0) gunAngle = 1;		// Avoid infinity calculations
		if (gunAngle === 180) gunAngle = 179;
		var XTarget = Math.round(400 + (548 * Math.tan((gunAngle-90)*Math.PI/180)));		// calculate target x-coord
		console.log(gunAngle, XTarget);
		return XTarget;
	}

	function explodeGun() {
		playSound('explosion');
		game.state = '';							// Disable key input
		$('#gun').removeClass()
			     .css({"left":"-=12px"})			// Shift left to accommodate explosion sprite
				 .fadeOut(2000, function() {		// Fade out (takes longer than explode animation)
						gameOver(2);
				 });
		explode($('#gun'));
	}


	/*********************/
	/*! BULLET FUNCTIONS */
	/*********************/
	function newBullet() {
		if (game.entities.activeBullets.length < game.params.maxBullets) {	// room for another bullet?
			var bulletID = 'bullet' + game.entities.bid;					// e.g. "bullet33"

			var $bullet = $('<div id="'+ bulletID +'"></div>')	// Create bullet element
						.addClass('bullet')
						.data("bid",game.entities.bid)
						.appendTo('#gamefield');				// Add bullet to document
			game.entities.activeBullets.push($bullet);			// Register bullet
			game.entities.bid++;

			// Prepare the bullet:
			var XTarget = findTarget(player.gun.angle);
			var bulletTime = (548/Math.abs(Math.cos((player.gun.angle-90)*Math.PI/180)))/game.params.bulletSpeed;	// Bullet animation time = distance over speed
			var target = {"top":"1px", "left":XTarget};
			$bullet.data("XTarget", XTarget)			// Attach its target info
				   .data("bulletTime", bulletTime)		// Attach its total travel time
				   .data("hits", 0);

			// Change trajectory for horizontal bullets:
			if (XTarget > 10000 || XTarget < -10000) {
				target = {"left":XTarget};
				bulletTime = (Math.abs(XTarget)-400)/game.params.bulletSpeed;
			}
			// Move bullet:
			$bullet.velocity(target, bulletTime, "linear", function() {	// Move the bullet
				$(this).remove();													// When anim finishes, remove bullet
				deregisterBullet(this);
			});

			playSound('bullet');
			game.levelStats.bulletsFired++;
			player.gun.ammo--;
			testAmmoDepletion();		// Check if ammo stuck on zero
			updateStats();
		}
	}

	function deregisterBullet($bullet) {
		for (var key in game.entities.activeBullets) {					// find our expired bullet's index
			if (game.entities.activeBullets[key] === $bullet) break;		// WHY DOES THIS MATCH AND NOT FOR PLANES?
		}
		game.entities.activeBullets.splice(key,1);							// remove the expired bullet
		updateStats();
	}

	function resumeBullets() {					// Restart bullets on unpause
		for (var $bullet of game.entities.activeBullets) {
			var XTarget = $bullet.data("XTarget");		// Read its target
			var y = parseInt($bullet.css("top"));		// Read its y-coord
			var oldTime = $bullet.data("bulletTime");	// Read its old travel time
			var newTime = oldTime * y/548;				// Calculate the new travel time

			$bullet.velocity({"top":"0","left":XTarget}, newTime, "linear", function() {	// Re-animate the bullet
				$(this).remove();														// When anim finishes, remove bullet
				deregisterBullet(this);
			});
		}
	}

	function showCombo(x,y,hits) {
		$('.combo').remove();								// Clear all previous combo icons
		var points = game.params.comboPoints[(hits-1)%4];	// 125, 250, 500 or 750
		if (points <= 125) playSound('combo1');
		else playSound('combo2');
		var $comboHtml = $('<div class="combo"></div>');
		$comboHtml.addClass('p'+points)
				  .prependTo('#gamefield')
				  .css("left",x)
				  .css("top",y+20)
				  .fadeOut(1500);
		game.levelStats.comboScore += points;
	}

	function measureComboChain(hid) {
		// example comboChain array: (1,2,3) <- 4 comes in
		game.levelStats.comboChain.push(hid);							// Add the new hitting bullet ID
		var comboSize;
		var n = game.levelStats.comboChain.length;							// Array should never be empty except at start of level

		if (n>1) {
			if (game.levelStats.comboChain[n-1] - game.levelStats.comboChain[n-2] === 1) {	// If newest bullet makes a consecutive hit,
				comboSize = n-1;					// Return the new combo length
			}
			else {										// If not consecutive,
				game.levelStats.comboChain = [];				// Empty the array
				game.levelStats.comboChain.push(hid);		// Add back in the hitting bullet ID
				comboSize = 0;						// No combo awarded
			}
		}

		return (comboSize) ? comboSize : 0;				// Return comboSize if valid, or 0
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
		cleanup: null
	};

	loops.runAll = function() {
		this.collisionLoop = setInterval(function() {	// Start collision detection loop
			detectCollisions();
		}, 50);

		this.killsLoop = setInterval(function() {
			if (game.levelStats.planeKills % 40 === 0) $('#killCount').html();			// Reset kill icons after 40
			if (game.levelStats.planeKills >= game.levelStats.killsNeeded) gameOver(1);		// Enough kills to beat the level!
		}, 1000);

		this.planeGen = setInterval(function() {			// Start plane generator
			generatePlane();
		}, 750);

		this.paraGen = setInterval(function() {				// Start para generator
			generatePara();
		}, 2500);

		this.paraWalk = setInterval(function() {			// Ground paras walk every second
			walkParas();
		}, 1000);

		this.cleanup = setInterval(function() {				// Remove expired objects
			cleanup();
		}, 5000);

		this.driveByCheck = setInterval(function() {		// Make a drive-by occur once per level when the situation is desperate
			var a = (game.levelStats.driveBys > 0) ? true : false;
			var b = (game.entities.bunkerParasR.length >= 2 || game.entities.bunkerParasL.length >= 2) ? true : false;
			var c = (game.entities.groundParasR.length + game.entities.groundParasL.length > 4 ) ? true : false;
			var d = (Math.random() > 0.8) ? true : false;		// 1 in  5 chance

			if (a && b && c && d) {
				driveBy();
				game.levelStats.driveBys--;
			}
		}, 10000);	// Try every 10 seconds
	};

	loops.stopAll = function() {
		clearInterval(this.collisionLoop);				// Stop the generators
		clearInterval(this.killsLoop);
		clearInterval(this.planeGen);
		clearInterval(this.paraGen);
		clearInterval(this.paraFall);
		clearInterval(this.paraWalk);
		clearInterval(this.cleanup);
		clearInterval(this.driveByCheck);
	};


	/***********************************/
	/*! CONTINUOUSLY RUNNING FUNCTIONS */
	/***********************************/
	function generatePlane() {		// Generate planes randomly, based on quotas & level
		var r = Math.random();
		if (r < game.params.levelIntensities[game.level-1]) {	// 30% to 66% chance we make a new plane this time
			var rn = Math.random();
			var thr = 0;								// Threshold starts at 0

			for (var i = 0; i < 7; i++) { 	// For each plane's quota:
				thr += game.params.planeQuotas['level'+game.level][i];	// Set threshold for that plane
				if (rn < thr) {										// Test it
					newPlane(i);									// If true, create that plane
					break;											// And stop testing
				}
			}
		}
	}

	function generatePara() {		// Generate paras randomly from active planes
		var r = Math.random();
		if (r < game.params.levelIntensities[game.level-1] && game.entities.activePlanes.length > 0) {		// 30% to 66% chance we release a new para now
			var $plane = game.entities.activePlanes[Math.floor((game.entities.activePlanes.length)*Math.random())];	// Select an active plane at random
			newPara($plane);																// Bombs away!
		}
	}

	function detectCollisions() {
		// Get each of our bullets one by one:
		for (var $bullet of game.entities.activeBullets) {				// 8 bullets max
			var x = $bullet.position().left;
			var y = $bullet.position().top;

			if (x < 0 || x > 800) {			// Get rid of bullets that already went offscreen (low angle)
				deregisterBullet($bullet);
				$bullet.remove();
				continue;					// Don't test this one but continue testing the rest of the bullets
			}

			// Test against paras first (bullet can pass through them):
			for (var $para of game.entities.activeParas) {							// 5 paras max
				var p = $para.position().left;
				var q = $para.position().top;

				if (x-p < 24) {											// Simplistic proximity test
					if ((x>=p-3 && x<=p+23) && (y>=q-3 && y<=q+23)) {	// Bullet inside para coords (+1px margin)
						deregisterPara($para);
						killPara($para);
						console.log($para.attr("id")+" was hit by "+$bullet.attr("id")+"!");
						game.levelStats.hits++;
					 	game.levelStats.allKillsThisLevel[7]++;						// Count 1 para kill
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
				for (var $plane of game.entities.activePlanes) {							// 5 planes max
					var a = $plane.position().left;
					var b = $plane.position().top;

					if (x-a < 52) {											// Simplistic proximity test
						if ((x>=a-3 && x<=a+51) && (y>=b-7 && y<=b+23)) {	// Bullet inside plane coords
							// Update kill stats
							deregisterPlane($plane);		// Deregister plane (no more collision tests)

							if ($plane.data("planeType") === 'messerschmitt') divePlane($plane);
							else explodePlane($plane);

							game.levelStats.hits++;
							game.levelStats.planeKills++;
						 	game.levelStats.allKillsThisLevel[$plane.data("type")]++;	// Count 1 kill
							$('<div class="kill"></div>').appendTo('#killCount');	// Add 1 kill icon to counter
						 	player.gun.ammo += $plane.data("ammoBonus");			// Gain its ammo bonus
							console.log($plane.attr("id")+" was hit by "+$bullet.attr("id")+"! ("+game.levelStats.planeKills+"k)");
							// CODE STOPS AROUND HERE IN OPERA

							// Combo test:
							var hid = $bullet.data("bid");							// hitID
							var comboSize = measureComboChain(hid);					// Test the hitID for combos
							if (comboSize > 0) {
								showCombo(x,y, comboSize);
								console.log("COMBOOOO! ("+comboSize+")");
							}
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
		for (var $bullet of game.entities.activeBullets) {				// Problem: the frozen bullets are no longer registered in this array
			if (game.entities.bid - $bullet.data("bid") > 12) {
				deregisterBullet($bullet);
				$bullet.remove();
			}
		}
		for (var $plane of game.entities.activePlanes) {
			if (game.entities.pid - $plane.data("pid") > game.params.maxPlanesPerLevel[game.level-1] + 2) {	// could give premature removal of slow planes?
				deregisterPlane($plane);
				$plane.remove();
			}
		}
		for (var $para of game.entities.activeParas) {
			if (game.entities.mid - $para.data("mid") > game.params.maxParasPerLevel[game.level-1] + 2) {
				deregisterPara($para);
				$para.remove();
			}
		}
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

			playSound(planeType);

			var dest = $plane.data("dest");
			$plane.velocity({"left": dest}, planeSpeed, "linear", function() {	// Start it moving
				deregisterPlane($plane);
				$(this).remove();												// When anim finishes, remove it
			});
			updateStats();
		}
	}

	function deregisterPlane($plane) {
		for (var key in game.entities.activePlanes) {										// Find our expired plane's index
			if ($(game.entities.activePlanes[key]).attr("id") === $plane.attr("id")) break;	// Found it!	// only works matching on IDs
		}

		if (isNaN(key)) {
			console.log("could not find "+$plane.attr("id")+" in array of "+game.entities.activePlanes.length+" active planes to deregister");
		}
		else game.entities.activePlanes.splice(key,1);	// Remove the expired plane

		updateStats();
	}

	function divePlane($plane) {			// Make Messerschmitts dive and crash
		var startx = $plane.position().left;
		var dest;
		if ($plane.hasClass('ltr')) dest = startx + 350;		// Calculate landing site
		else if ($plane.hasClass('rtl')) dest = startx - 350;

		var diveLoop = setInterval(function() {			// Detect collisions with airborne paras
			var x = $plane.position().left + 17;		// Use sprite's centre coords
			var y = $plane.position().top + 20;
			for (var $para of game.entities.activeParas) {
				var a = $para.position().left + 10;
				var b = $para.position().top + 10;
				if (Math.abs(a-x) < 27 && Math.abs(y-b) < 30) {	// Diving plane touches air para
					console.log($para.attr("id")+" became propellor soup thanks to the crashing "+$plane.attr("id"));
					killPara($para);
				}
			}
		}, 100);

		playSound('dive');

		$plane.velocity('stop', true)	// clearQueue on
			  .addClass('diving')				// Needs to dive from y=60 to y=542
			  .velocity({"top":"558px", "left":dest+'px'}, 1000, 'linear', function() {	// Dive
					clearInterval(diveLoop);	// Stop detection of air paras
					killGPs(dest);				// Kill the paras it landed on

					//explode($plane);		// CAUSES FREEZING
					// explode() function duplicated here:	// WASTEFUL! FIXME
					playSound('explosion');		// BOOM!
					$plane.velocity('stop')
						  .removeClass('rtl ltr')
						  .addClass('exploding');	// 0.7s animation

					setTimeout(function() {
						$plane.remove();
						updateStats();
					}, 700);
			  });
	}

	function explodePlane($plane) {
		console.log("boom");
		// Stop continuous sound effect FIXME
		//sounds[eval($plane.data("planeType"))].stop();	// Stop the sound of that plane (WHAT IF 2 FLYING?)
		//sm2.stop(eval('sfx_'+$plane.data("planeType")));	// Stops the sound by soundid

		$plane.velocity('stop', true);	// clearQueue enabled
		explode($plane);
	}

	function explode($obj) {
		playSound('explosion');
		$obj.velocity('stop')
			.removeClass('rtl ltr grenade')
			.addClass('exploding');	// 0.7s animation

		setTimeout(function() {
			$obj.remove();
			updateStats();
		}, 700);
	}

	function resumePlanes() {
		for (var $plane of game.entities.activePlanes) {
			var x = $plane.position().left;				// Get its x-coord
			var speed = $plane.data("speed");			// Read its speed data
			var dest = $plane.data("dest");				// Read its destination
			var newTime = ($plane.hasClass('ltr')) ? speed * (800-x)/800 : speed * (x/800);

			// Re-animate the plane:
			$plane.velocity({"left": dest}, newTime, 'linear', function() {
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
					.addClass('floating')
					.css({"left":dropX, "top":dropY})			// Give para the coords
					.prependTo('#gamefield');					// Add him to the document
			game.entities.activeParas.push($para);					// Register para
			game.entities.mid++;

			if (planeX > 350 && planeX <= 400) {
				$para.velocity({"left":"-=50px", "top":"+=50px"}, 3000);	// Drift para out of 100px central channel
			}
			if (planeX > 400 && planeX < 440) {
				$para.velocity({"left":"+=50px", "top":"+=50px"}, 3000);
			}
			if (planeX > 790) {
				$para.velocity({"left":"-=50px", "top":"+=50px"}, 3000);	// Drift away from screen edges
			}
			if (planeX < 10 || isNaN(planeX)) {
				$para.velocity({"left":"+=50px", "top":"+=50px"}, 3000);
			}

			$para.velocity({"top":"564px"}, game.params.paraSpeed, "linear", function() {	// Drop him
				paraLand($para);
			});
		}
	}

	function killPara($para) {
		// Sound effect:
		var n = 1 + Math.floor(5*Math.random());	// Integer 1-5
		switch (n) {
			case 1: playSound('paraHit1'); break;
			case 2: playSound('paraHit2'); break;
			case 3: playSound('splat1'); break;
			case 4: playSound('splat2'); break;
			case 5: playSound('splatargh'); break;
		}

		$para.velocity('stop', true)	// clearQueue enabled - terminates any earlier animation and guarantees his removal
			 .removeClass('floating')
			 .addClass('shot')
			 .animate({"top":"+=2px"}, 700, function() {
				$(this).remove();
			 });
		updateStats();
	}

	function deregisterPara($para) {
		for (var key in game.entities.activeParas) {					// find our expired para's index
			if (game.entities.activeParas[key] === $para) break;
		}
		game.entities.activeParas.splice(key,1);						// remove the expired para
		updateStats();
	}

	function resumeParas() {
		for (var $para of game.entities.activeParas) {
			var y = $para.position().top;						// Get his y-coord
			var newSpeed = game.params.paraSpeed * (564-y)/564;	// Calculate new drop time

			$para.velocity({"top":"564px"}, newSpeed, 'linear', function() {
				if ($para.position().top === 564) paraLand($para);		// Now he can land
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
		game.levelStats.landedParas++;

		$para.removeClass('floating')					// Convert para to a groundPara
			   .addClass('ground')
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
		for (var $groundPara of groundParas) {

			var pos = $groundPara.position().left;
			var dest = parseInt($groundPara.data("dest"));

			if (Math.abs(pos - dest) < 2) {						// If he's really close...
				reachBunker($groundPara);						// He's allowed to reach the bunker
			}
			else {												// Else keep walking...
				if ($groundPara.hasClass("left")) {							// If he's on the left, walk right
					$groundPara.velocity({"left":"+=3px"}, 200);
				}
				else if ($groundPara.hasClass("right")) {							// If he's on the right, walk left
					$groundPara.velocity({"left":"-=3px"}, 200);
				}
			}
		}
	}

	function reachBunker($groundPara) {
		var groundParaID = $groundPara.attr("id");
		var bunkerParaID = groundParaID.replace('ground','bunker');
		var n = null;
		var key;
		$groundPara.attr("id", bunkerParaID);				// Add bunker prefix to his id

		if($groundPara.hasClass("left")) {
			for (key in game.entities.groundParasL) {					// Find the groundPara's index
				if (game.entities.groundParasL[key] === $groundPara) n = key;
			}
			game.entities.groundParasL.splice(n,1);							// Remove him from groundParas array

			game.entities.bunkerParasL.push($groundPara);					// Register him as a bunker para (L)
			console.log($groundPara.attr("id") + " arrived at the left bunker");
		}
		else if($groundPara.hasClass("right")) {
			for (key in game.entities.groundParasR) {					// Find the groundPara's index
				if (game.entities.groundParasR[key] === $groundPara) n=key;
			}
			game.entities.groundParasR.splice(n,1);							// Remove him from groundParas array

			game.entities.bunkerParasR.push($groundPara);					// Register him as a bunker para (R)
			console.log($groundPara.attr("id") + " arrived at the right bunker");
		}

		$groundPara.addClass("bunker");			// Causes his walk cycle to stop being called

		// Make them line up:
		var bPL = game.entities.bunkerParasL;
		var bPR = game.entities.bunkerParasR;
		for (var i = 0, ll = bPL.length; i < ll; i++) {
			bPL[i].css("left", 350 - (10*i) + 'px');		// Each new bunkerPara stands 10px back from previous one
		}
		for (var j = 0, lr = bPR.length; j < lr; j++) {
			bPR[j].css("left", 440 + (10*j) + 'px');
		}

		updateStats();

		if (game.entities.bunkerParasL.length >= player.gun.defence) paraBunkerStorm('left');
		if (game.entities.bunkerParasR.length >= player.gun.defence) paraBunkerStorm('right');
	}

	function paraBunkerStorm(side) {
		// animate paras storming the bunker
		console.log('paras are storming your bunker on the '+side+' side!');
		playSound('bunkerStorm');

		if (side === 'right') {
			$(game.entities.bunkerParasR[0]).velocity({"top":"560px","left":"440px"}, 700, 'linear', function() {
				$(game.entities.bunkerParasR[1]).velocity({"top":"542px","left":"440px"}, 800, 'linear', function() {
					$(game.entities.bunkerParasR[2]).velocity({"top":"524px","left":"440px"}, 900, 'linear', function() {
						$('<div class="bullet"></div>')
							.css("left","440px")
							.css("top","525px")
							.appendTo('#gamefield')
							.velocity({"left":"400px"}, 1000, 'linear', function() {		// Fire a bullet at the gun
								$(this).remove();
								explodeGun();
							});
					});
				});
			});
		}
		else if (side === 'left') {
			$(game.entities.bunkerParasL[0]).velocity({"top":"560px","left":"350px"}, 700, 'linear', function() {
				$(game.entities.bunkerParasL[1]).velocity({"top":"542px","left":"350px"}, 800, 'linear', function() {
					$(game.entities.bunkerParasL[2]).velocity({"top":"524px","left":"350px"}, 900, 'linear', function() {
						$('<div class="bullet"></div>')
							.css("left","360px")
							.css("top","525px")
							.appendTo('#gamefield')
							.velocity({"left":"400px"}, 1000, 'linear', function() {		// Fire a bullet at the gun
								$(this).remove();
								explodeGun();
							});
					});
				});
			});
		}
	}


	/************************/
	/*! SLAUGHTER FUNCTIONS */
	/************************/
	function grenade(side) {
		var target = (side === 'left') ? '-=30px' : '+=30px'; 	// Aim left or right?

		var $nade = $('<div class="grenade"></div>')			// Create the grenade
						.appendTo('#gamefield')					// Add it to document
						.velocity({"left":target,"bottom":"+=30px"}, 250, "swing", function() {				// y upwards
			   				$(this).velocity({"left":target,"bottom":"18px"}, 200, "swing", function() {		// y downwards
								playSound('explosion');
								killGPs($nade.position().left);
								$nade.velocity({"left":"-=24px"}, 1, function() {	// shift to accommodate explosion sprite
									explode($nade);
								});
							});
						});
		player.grenades--;
		setGrenades();
		updateStats();
	}

	function killGPs(groundzero) {
		var groundParas = game.entities.groundParasR.concat(game.entities.groundParasL)
													.concat(game.entities.bunkerParasR)
													.concat(game.entities.bunkerParasL);
		for (var $para of groundParas) {
			var x = $para.position().left;
			if (x <= groundzero+20 && x >= groundzero-20) {	// If he's in the blast zone,
				console.log($para.attr("id")+" is going home in a plastic bag.");
				$para.remove();
				// Play sound if hit:
				if (Math.random() > 0.5) playSound('paraHit1');
				else playSound('paraHit2');
			}
		}
		rebuildGroundArrays();
		updateStats();
	}

	function driveBy() {
		var $car = $('<div id="car"></div>').appendTo('#gamefield');			// Create the car
		playSound('driveby');
		var allParas = game.entities.groundParasL.concat(game.entities.bunkerParasL)
											.concat(game.entities.bunkerParasR)
											.concat(game.entities.groundParasR);		// All paras to die

		var detectRunOverParas = setInterval(function() {
			for (var $para of allParas) {
				var pos = parseInt($para.css("left"));				// Get the para coord
				var carPos = parseInt($car.css("left"));			// Get the car coord

				if (pos >= carPos && pos <= carPos+38) {		// When collision detected,
					killPara($para);
					//$para.remove();							// The para dies
					console.log($para.attr("id")+' got squished!');
				}
			}
		}, 75);				// when driveBy() is called, run collision detection every 75ms

		console.log("Car start");
		$car.velocity({"left":"800px"}, 2500, 'linear', function() {		// Drive the car
			$(this).remove();
			console.log("Car end");
			clearInterval(detectRunOverParas);	// Screen traversed, stop detecting collisions
		});

		rebuildGroundArrays();		// Clears the arrays
	}

	// Use this directly after grenade, driveby, plane crash...
	function rebuildGroundArrays() {
		// Rebuild the 4 arrays from scratch (easier than splicing shit around)
 		game.entities.groundParasR = [];
		game.entities.groundParasL = [];
		game.entities.bunkerParasR = [];
		game.entities.bunkerParasL = [];

		$('#gamefield div.para.ground').each(function() {		// Get every para on the ground
			var idPrefix = $(this).attr("id").substr(0,6);
			// Assign him to the correct array:
			if (idPrefix === 'bunker' && $(this).hasClass('left')) game.entities.bunkerParasL.push($(this));
			if (idPrefix === 'ground' && $(this).hasClass('left')) game.entities.groundParasL.push($(this));
			if (idPrefix === 'bunker' && $(this).hasClass('right')) game.entities.bunkerParasR.push($(this));
			if (idPrefix === 'ground' && $(this).hasClass('right')) game.entities.groundParasR.push($(this));
		});
		updateStats();
	}


	/*! jQuery document.ready() { */
	$(function() {	// on document ready:

		$.ajaxSetup ({
			cache: true
		});

		/***************/
		/*! CLICKABLES */
		/***************/
		// Detect all clicks within #overlay and act upon clicked element's id
		$('#overlay').click(function(e){
			var clickedID = e.target.id;

			if ($(e.target).hasClass('button')) {
				playSound('click');

				switch(clickedID) {
				case 'startgame':
					// Process menu selections:
					if (game.options.gfxEnabled) swapSprites(2009);
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
					ui.showOverlay('rules');
					break;
				case 'showscore':
					ui.showOverlay('score');
					break;
				case 'showshop':
					ui.showOverlay('shop');
					break;
				case 'back':
					ui.showOverlay(game.lastOverlay);
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
					game.options.sfxEnabled = (suffix === 'on') ? true : false;
					break;
				case 'mus':
					game.options.musicEnabled = (suffix === 'on') ? true : false;
					break;
				case 'gfx':
					game.options.gfxEnabled = (suffix === 'on') ? true : false;
					break;
				}
			}
			return false;	// Whatever it was, don't follow <a href="#">
		});

		// Non-overlay clicks (When user mouseclicks the gamefield during play):
		$('#gamefield').click(function(e) {
			var clickedID = e.target.id;

			if (game.state === 'running') {
				if (clickedID === 'vol_mute') {
					gameMuteToggle();
					$(e.target).toggleClass('muted').toggleClass('unmuted');	// Change icon
				}
				else if (clickedID === 'vol_down') {
					adjustGameVolume(-10);
				}
				else if (clickedID === 'vol_up') {
					adjustGameVolume(+10);
				}
				else {
					$('#tooltip').css("left", e.pageX)			// Position the hidden tooltip div at the mouse pointer
								 .css("top", e.pageY)
								 .toggle();						// Turn it on/off
				}
			}
			return false;	// No-follow
		});

		// Start game from title screen:
		$('img#title').click(function() {
			$(this).velocity({"top":"-=600px"}, 500, 'linear', function() {
				updateStats();
				ui.showOverlay('menu');
			});
		});

		// Stats screen clickables:
		$("#overlay .stats a").click(function() {
			console.log($(this));
			$(this).parent.html(game.levelStats.scores.loadScore());
		});

		// Shop screen:
		$('#shop p a').click(function() {	// Each time a 'Buy' button is clicked
			var item = $(this).attr("id");		// Get id of clicked button
			shop.buyItem(item);
		});


		/**********/
		/*! INPUT */
		/**********/
		// Register keypress events on the whole document
		// From: http://www.marcofolio.net/webdesign/advanced_keypress_navigation_with_jquery.html
		$(document).keydown(function(e) {			// keydown is Safari-compatible; keypress allows holding a key to send continuous events

			if (game.state === 'running') {		// GAME KEYS - DISABLED WHEN PAUSED, or in MENU, INTRO, ETC

				if (!e.shiftKey && e.keyCode === 37 && player.gun.angle >= 7.5) {	// press left arrow
					updateGunAngle(-7.5);
				}
				if (!e.shiftKey && e.keyCode === 39 && player.gun.angle <= 172.5) {	// press right arrow
					updateGunAngle(+7.5);
				}
				if (e.shiftKey && e.keyCode === 37 && player.gun.angle >= 15) {	// press SHIFT + left arrow
					updateGunAngle(-15);
				}
				if (e.shiftKey && e.keyCode === 39 && player.gun.angle <= 165) {	// press SHIFT + right arrow
					updateGunAngle(+15);
				}
				if (e.keyCode === 32 && player.gun.ammo > 0) {			// press 'space'
					newBullet();									// fire gun
				}
				if (e.keyCode === 90 && player.grenades > 0) {		// press 'z'
					grenade('left');								// grenade L
				}
				if (e.keyCode === 88 && player.grenades > 0) {		// press 'x'
					grenade('right');								// grenade R
				}
				if (e.keyCode === 81) {								// press 'q'
					gameOver(4);
				}
			}

			if (e.keyCode === 80) {									// press 'p'
				if (game.state === 'running') pause();				// pause/unpause
				else if (game.state === 'paused') unpause();
			}

			// Temporary keys (aka CHEATS!)
			if (e.keyCode === 68) {									// press 'd'
				driveBy();
			}
			if (e.keyCode === 75) {									// press 'k'
				game.levelStats.planeKills += 13;						// gain 13 kills
			}
			if (e.keyCode === 65) {									// press 'a'
				player.gun.ammo += 40;								// extra bullets
			}
			if (e.keyCode === 71) {									// press 'g'
				player.grenades += 1;								// gain 1 grenade
				setGrenades();
			}
			if (e.keyCode === 77) {									// press 'm'
				player.scores.spendableScore += 1000000;			// gain 1000000 points
			}
			$('#keypress').html(e.keyCode);		// Show onscreen
		});

	}); // End of "document ready" jQuery


	// Reveal the minimum from the module:
	return {
		game: game,
		sounds: sounds
	};

}($));	// pass in jQuery dependency to IIFE
