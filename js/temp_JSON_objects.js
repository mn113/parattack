var planeObj = {
	pid : pid,
	type : 0,
	model : planeTypes[this.type],
	speed : planeSpeeds[this.type],
	ammoBonus : extraBulletsPerKill[this.type],
	direction: 'ltr',
	id : this.model + this.pid,
	class: plane,
	html : '<div id="'+this.id+'" class="plane '+this.model+' '+this.direction+'"></div>',
	
	create : function(type) {
		if (Math.random() > 0.5) {	// Flip it 50% of the time
			$(this).addClass('rtl');
		}
		else {
			$(this).addClass('ltr');
		}
		$(this.html).prependTo('#gamefield');
		activePlanes.push(this);				// Register it as active
		pid++;		
		updateStats();		
	},
	
	fly : function() {
		if ($(this).hasClass('rtl')) {
			.animate({"left":"-50px"}, this.speed, "linear", function() {		// Start it moving
				deregister(this);
				$(this).remove();												// When anim finishes, remove it
			});									
		}
		else if ($(this).hasClass('ltr')) {
			.animate({"left":"800px"}, this.speed, "linear", function() {		// Start it moving
				deregister(this);
				$(this).remove();												// When anim finishes, remove it
			});									
		}
		updateStats();
	}

	deregister : function() {
		var n = null;
		for (var key in activePlanes) {					// Find our expired plane's index
			if (activePlanes[key] == this) n=key;		// Found it!
		}
		if(n) {												// If we found it,
			activePlanes.splice(n,1);						// Remove the expired plane
		}
		else {
			console.log("could not find "+this.id+" in array of "+activePlanes.length+" active planes to deregister");
		}
		updateStats();
	}

	explode : function() {
		// run bulk of behavior here
	}

	resume : function() {
		// run bulk of behavior here
	}

}