var Functions = {
	resetStates: function()
	{
		for (var name in Game.creeps)
		{
			var creep = Game.creeps[name];

			delete creep.memory.state;
			delete creep.memory.sourceId;

			console.log("Creep " + creep.name + " state reset");
		}

		delete Memory.sourcesQueue;
	}
};

module.exports = Functions;