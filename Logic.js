var _ = require('lodash');

var MOVE_PARAMS = {visualizePathStyle: {stroke: '#ffffff'}};

var Logic =
{
	ROLE_WIDTHDRAW: "widthdraw",
	ROLE_PICKUP: "pickup",
	ROLE_HARVEST: "harvest",

	PRIORITIES: {
		Logic.ROLE_WIDTHDRAW: 10,
		Logic.ROLE_PICKUP: 9,
		Logic.ROLE_HARVEST: 8
	},

	savedMatrix: {},

	/** @param {Room} room **/
	spawnCreeps: function(room)
	{
		var creeps = room.find(FIND_MY_CREEPS);
		if (creeps.length >= 15)
			return;

		var creeps_count = creeps.length;

		var spawns = room.find(FIND_MY_SPAWNS);
		for (var i = 0; i < spawns.length && creeps_count < 15; i++)
		{
			var spawn = spawns[i];
			if (spawn.spawning != null)
				continue;

			var name = "Creep_" + Memory.creepId;
			if (spawn.spawnCreep([WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], name) != OK)
				continue;

			spawn.room.visual.text("🛠 spawn", spawn.pos.x + 1, spawn.pos.y, {align: 'left', opacity: 0.8});
			console.log("Spawning new creep: " + name);

			Memory.creepId++;
			creeps_count++;
		}
	},

	getCostMatrix: function(roomName)
	{
		if (Logic.savedMatrix[roomName] !== undefined)
			return Logic.savedMatrix[roomName];

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

		Logic.savedMatrix[roomName] = costs;

		return costs;
	},

	/** @param {Room} room **/
	getRoomCreeps: function(room)
	{
		return room.find(FIND_MY_CREEPS);
	},

	/** @param {Creep} creep **/
	setRole: function(creep, role, path)
	{
		Logic.removeRole(creep);

		creep.room.memory.roles[role]++;
		creep.memory.role = role;
		creep.memory.path = creep.room.serializePath(path);
	},

	/** @param {Creep} creep **/
	removeRole: function(creep)
	{
		if (creep.memory.role === undefined)
			return;

		var role = creep.memory.role;

		if (role == Logic.ROLE_HARVEST)
			Logic.removeSource(creep);

		creep.room.memory.roles[role]--;
		delete creep.memory.role;
		delete creep.memory.path;
	},

	/** @param {Creep} creep **/
	checkRole: function(creep, newRole)
	{
		if (creep.memory.role === undefined)
			return true;

		var oldRole = creep.memory.role;

		return (Logic.PRIORITIES[newRole] > Logic.PRIORITIES[oldRole]);
	},

	/** @param {Creep} creep **/
	addSource: function(creep, sourceId)
	{
		creep.memory.sourceId = sourceId;
		Memory.sourceWorkers[creep.memory.sourceId]++;
	},

	/** @param {Creep} creep **/
	removeSource: function(creep)
	{
		if (creep.memory.sourceId === undefined)
			return;

		Memory.sourceWorkers[creep.memory.sourceId]--;
		delete creep.memory.sourceId;
	},

	/** @param {Room} room **/
	doWidthdraw: function(room, creeps)
	{
		var roles = room.memory.roles;
		if (roles[Logic.ROLE_WIDTHDRAW] != 0)
			return;

		var tombstones = room.find(FIND_TOMBSTONES, {
			filter: (structure) => structure.store[RESOURCE_ENERGY] != 0
		});

		if (tombstones.length == 0)
			return;

		// Working with first tombstone only
		var tombstone = tombstones[0];

		var filtered = _.filter(creeps, function(creep) {
			if (!Logic.checkRole(Logic.ROLE_WIDTHDRAW))
				return;
			return creep.carry.energy + tombstone.store[RESOURCE_ENERGY] <= creep.carryCapacity;
		});
		if (filtered.length == 0)
			return;

		var result = PathFinder.search(tombstone.pos, filtered, {plainCost: 2, swampCost: 10, roomCallback: Logic.getCostMatrix});
		if (result.incomplete)
			return;

		var path = result.path;

		var creepPos;
		if (path.length != 0)
			creepPos = path[path.length - 1];
		else
			creepPos = tombstone.pos;

		var targets = room.lookForAt(LOOK_CREEPS, creepPos);
		if (targets.length == 0)
			return;

		var creep = targets[0];

		Logic.setRole(creep, Logic.ROLE_WIDTHDRAW, path);
	},

	/** @param {Room} room **/
	doPickup: function(room, creeps)
	{
		var roles = room.memory.roles;
		if (roles[Logic.ROLE_PICKUP] != 0)
			return;

		var resources = room.find(FIND_DROPPED_RESOURCES);
		if (resources.length == 0)
			return;

		var resource = resources[0];

		var filtered = _.filter(creeps, function(creep) {
			if (!Logic.checkRole(Logic.ROLE_PICKUP))
				return;
			return creep.carry.energy + resource.amount <= creep.carryCapacity;
		});
		if (filtered.length == 0)
			return;

		var result = PathFinder.search(resource.pos, filtered, {plainCost: 2, swampCost: 10, roomCallback: Logic.getCostMatrix});
		if (result.incomplete)
			return;

		var path = result.path;

		var creepPos;
		if (path.length != 0)
			creepPos = path[path.length - 1];
		else
			creepPos = resource.pos;

		var targets = room.lookForAt(LOOK_CREEPS, creepPos);
		if (targets.length == 0)
			return;

		var creep = targets[0];

		Logic.setRole(creep, Logic.ROLE_PICKUP, path);
	},

	/** @param {Room} room **/
	doHarvest: function(room, creeps)
	{
		var sources = room.find(FIND_SOURCES_ACTIVE);
		if (sources.length == 0)
			return;

		sources = _.sortBy(sources, [function(source) {
			return Memory.sourceWorkers[source.id];
		}]);

		var workers_cur = _.reduce(sources, function(sum, source) {
			return sum + Memory.sourceWorkers[source.id];
		}, 0);

		var filtered = _.filter(creeps, function(creep) {
			if (!Logic.checkRole(Logic.ROLE_HARVEST))
				return;
			return creep.carry.energy < creep.carryCapacity;
		});

		var workers_max = Math.ceil((workers_cur + filtered.length) / sources.length);

		for (var i = 0; i < sources.length; i++)
		{
			var source = sources[i];

			var workers = Memory.sourceWorkers[source.id];

			while (workers < workers_max && filtered.length != 0)
			{
				var result = PathFinder.search(source.pos, filtered, {plainCost: 2, swampCost: 10, roomCallback: Logic.getCostMatrix});
				if (result.incomplete)
					break;

				var path = result.path;

				var creepPos;
				if (path.length != 0)
					creepPos = path[path.length - 1];
				else
					creepPos = resource.pos;

				var targets = room.lookForAt(LOOK_CREEPS, creepPos);
				if (targets.length == 0)
					break;

				var creep = targets[0];

				Logic.setRole(creep, Logic.ROLE_HARVEST, path);
				Logic.addSource(creep, source.id);

				filtered.splice(filtered.indexOf(creep), 1);
				workers++;
			}
		}
	},

	/** @param {Room} room **/
	getActions: function(room)
	{
		// Tombstone [Widthdraw] 1
		// Resource [Pickup] 1

		// if energy >= 25%
		// Tower [Transfer] (If hostile creeps in room)
		// Spawn [Transfer]
		// Extension [Transfer]
		// Construction Site [Build]
		// Tower [Transfer] (If NO hostile creeps in room)

		// Source [Harvest]

		// Controller [Upgrade]

//		HARVESTING
//		BUILDING
//		TRANSFERRING
//		UPGRADING
//		TOMBSTONE
//		RESOURCES

		// FIND_MY_STRUCTURES
		// FIND_MY_CONSTRUCTION_SITES
		// FIND_TOMBSTONES
		// FIND_SOURCES_ACTIVE

		if (room.memory.roles === undefined);
			room.memory.roles = {};

		var roles = room.memory.roles;
		for (var role in Logic.PRIORITIES)
		{
			if (roles[role] === undefined)
				roles[role] = 0;
		}

		var creeps = Logic.getRoomCreeps(room);

		Logic.doWidthdraw(room, creeps);
		Logic.doPickup(room, creeps);
		Logic.doHarvest(room, creeps);
	},

	initQueue: function()
	{
		if (Memory.creepId === undefined)
			Memory.creepId = 1;

		if (Memory.sourceWorkers === undefined)
			Memory.sourceWorkers = {};

		for (var name in Game.rooms)
		{
			var sources = Game.rooms[name].find(FIND_SOURCES);

			for (var i = 0; i < sources.length; i++)
			{
				var source = sources[i].id;

				if (Memory.sourceWorkers[source] !== undefined)
					continue;
				Memory.sourceWorkers[source] = 0;
			}
		}
	},

	checkDead: function()
	{
		for (var name in Memory.creeps)
		{
			if (Game.creeps[name] !== undefined)
				continue;

			var sourceId = Memory.creeps[name].sourceId;
			if (sourceId !== undefined)
				Memory.sourceWorkers[sourceId]--;

			delete Memory.creeps[name];
		}
	},

	run: function()
	{
		Logic.initQueue();
		Logic.checkDead();

		for (var name in Game.rooms)
		{
			Logic.spawnCreeps(Game.rooms[name]);
			Logic.getActions(Game.rooms[name]);
		}
	}
};

module.exports = Logic;