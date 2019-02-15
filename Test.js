var _ = require('lodash');

var Test =
{
	/** @param {Room} room **/
	getRoomCreeps: function(room)
	{
		var result = {};

		var creeps = room.find(FIND_MY_CREEPS);
		for (var i = 0; i < creeps.length; i++)
		{
			var creep = creeps[i];
			result[creep.name] = creep;
		}

		return result;
	},

	getCostMatrix: function(roomName)
	{
		var room = Game.rooms[roomName];

		var costs = new PathFinder.CostMatrix;

		room.find(FIND_STRUCTURES).forEach(function(struct)
		{
			if (struct.structureType === STRUCTURE_ROAD)
				costs.set(struct.pos.x, struct.pos.y, 1);
			else if (struct.structureType !== STRUCTURE_CONTAINER && (struct.structureType !== STRUCTURE_RAMPART || !struct.my))
				costs.set(struct.pos.x, struct.pos.y, 0xff);
		});

		room.find(FIND_CREEPS).forEach(function(creep)
		{
			costs.set(creep.pos.x, creep.pos.y, 0xff);
		});

		return costs;
	},

	run: function()
	{
		var room = Game.spawns["Spawn1"].room;

		var creeps = room.find(FIND_MY_CREEPS);

		var sources = room.find(FIND_SOURCES_ACTIVE);
		if (sources.length == 0)
			return;

		sources = _.sortBy(sources, [function(source) {
			return Memory.sourceWorkers[source.id];
		}]);

		var workers_cur = _.reduce(sources, function(sum, source) {
			return sum + Memory.sourcesQueue[source.id];
		}, 0);

		var filtered = _.filter(creeps, function(creep) {
			if (creep.memory.state == 1)
				return false;
			return creep.carry.energy < creep.carryCapacity;
		});

		var workers_max = Math.ceil((workers_cur + filtered.length) / sources.length);

		console.log("creeps = " + creeps.length);
		console.log("sources = " + sources.length);
		console.log("workers_cur = " + workers_cur);
		console.log("filtered = " + filtered.length);
		console.log("workers_max = " + workers_max);

		for (var i = 0; i < sources.length; i++)
		{
			var source = sources[i];

			var workers = Memory.sourcesQueue[source.id];

			console.log("Source " + source.id + " workers = " + workers);

			while (workers < workers_max && filtered.length != 0)
			{
				var result = PathFinder.search(source.pos, filtered, {plainCost: 2, swampCost: 10, roomCallback: Test.getCostMatrix});
				if (result.incomplete)
				{
					console.log("Path incomplete");
					break;
				}

				var path = result.path;

				var creepPos;
				if (path.length != 0)
					creepPos = path[path.length - 1];
				else
					creepPos = resource.pos;

				var targets = room.lookForAt(LOOK_CREEPS, creepPos);
				if (targets.length == 0)
				{
					console.log("No creep at destination");
					break;
				}

				var creep = targets[0];

				console.log("set role for creep " + creep + " for source " + source);

//				Logic.setRole(creep, Logic.ROLE_HARVEST, path);
//				Logic.addSource(creep, source.id);

				filtered.splice(filtered.indexOf(creep), 1);
				workers++;
			}
		}
	}
};

module.exports = Test;