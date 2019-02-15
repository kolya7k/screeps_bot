var MOVE_PARAMS = {visualizePathStyle: {stroke: '#ffffff'}};

var CreepModule =
{
	State: {
		NONE: 0,
		HARVESTING: 1,
		BUILDING: 2,
		TRANSFERRING: 3,
		UPGRADING: 4
	},

	StateNames: [
		null,
		"🔄 harvest",
		"🚧 build",
		"⚡ transfer",
		"☝ upgrade"
	],

	/** @param {Creep} creep **/
	getState: function(creep)
	{
		if (creep.memory.state != CreepModule.State.NONE)
			return creep.memory.state;

		if (creep.carry.energy <= 25)
			return CreepModule.State.HARVESTING;

		var structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
			filter: (structure) => structure.energy < structure.energyCapacity && structure.structureType != STRUCTURE_LINK
		});

		if (structure != null)
			return CreepModule.State.TRANSFERRING;

		var site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
		if (site != null)
			return CreepModule.State.BUILDING;

		return CreepModule.State.UPGRADING;
	},

	/** @param {Creep} creep **/
	updateState: function(creep)
	{
		var newState = CreepModule.getState(creep);
		if (newState == CreepModule.State.NONE)
			return;

		if (creep.memory.state === newState)
			return;

//		console.log("Creep " + creep.name + " state " + creep.memory.state + " -> " + newState);

		creep.memory.state = newState;

		creep.say(CreepModule.StateNames[newState]);
	},

	/** @param {Creep} creep **/
	resetState: function(creep)
	{
		creep.memory.state = CreepModule.State.NONE;
	},

	/** @param {Creep} creep **/
	findSource: function(creep)
	{
		var sourceNear = Game.getObjectById("59bbc3b22052a716c3ce6936");
		var sourceFar = Game.getObjectById("59bbc3b22052a716c3ce6934");

//		console.log("Queue state " + Memory.sourcesQueue[sourceNear.id] + " / " + Memory.sourcesQueue[sourceFar.id]);

		var target;
		if (Memory.sourcesQueue[sourceNear.id] < 4 && sourceNear.energy != 0)
			target = sourceNear;
		else
			target = sourceFar;

		return CreepModule.harvestTarget(creep, target);

/*
		var objects = creep.room.find(FIND_SOURCES);
		while (objects.length != 0)
		{
			const target = creep.pos.findClosestByPath(objects);
			if (target == null)
				break;

			var result = creep.harvest(target);
			if (result == ERR_NOT_IN_RANGE)
				result = creep.moveTo(target, MOVE_PARAMS);

			if (result == OK || result == ERR_TIRED)
			{
				CreepModule.addSource(creep, target.id);
				return true;
			}

			console.log("Creep " + creep.name + " can't harvest resource " + target.pos + " trying next");

			objects.splice(objects.indexOf(target), 1);
		}

		console.log("Creep " + creep.name + " can't choose SOURCE");
		return false;
*/
	},

	/** @param {Creep} creep **/
	harvestTarget: function(creep, target)
	{
		var result = creep.harvest(target);
		if (result == ERR_NOT_IN_RANGE)
			result = creep.moveTo(target, MOVE_PARAMS);

		if (result == OK || result == ERR_TIRED)
		{
			CreepModule.addSource(creep, target.id);
			return true;
		}

		return false;
	},

	/** @param {Creep} creep **/
	addSource: function(creep, sourceId)
	{
		creep.memory.sourceId = sourceId;
		Memory.sourcesQueue[creep.memory.sourceId]++;
	},

	/** @param {Creep} creep **/
	forgetSource: function(creep)
	{
		if (creep.memory.sourceId === undefined)
			return;

		Memory.sourcesQueue[creep.memory.sourceId]--;
		delete creep.memory.sourceId;
	},

	/** @param {Creep} creep **/
	doHarvest: function(creep)
	{
		if (creep.carry.energy == creep.carryCapacity)
		{
			CreepModule.forgetSource(creep);
			return false;
		}

		if (creep.memory.sourceId === undefined)
		{
			// Rewrite to creep assign
			if (CreepModule.doWithdraw(creep))
				return true;
			return CreepModule.findSource(creep);
		}

		var source = Game.getObjectById(creep.memory.sourceId);
		if (source == null)
		{
			CreepModule.forgetSource(creep);
			return CreepModule.findSource(creep);
		}

		var result = creep.harvest(source);
		if (result == ERR_NOT_IN_RANGE)
			result = creep.moveTo(source, MOVE_PARAMS);

		if (result == OK || result == ERR_TIRED)
			return true;

		CreepModule.forgetSource(creep);
		return false;
	},

	/** @param {Creep} creep **/
	doBuild: function(creep)
	{
		var target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
		if (target == null)
			return false;

		var result = creep.build(target);
		if (result == ERR_NOT_IN_RANGE)
			result = creep.moveTo(target, MOVE_PARAMS);

		return (result == OK || result == ERR_TIRED);
	},

	/** @param {Creep} creep **/
	doTransfer: function(creep)
	{
		var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
			filter: (structure) => structure.energy < structure.energyCapacity && structure.structureType != STRUCTURE_LINK
		});

		if (target == null)
			return false;

		var result = creep.transfer(target, RESOURCE_ENERGY);
		if (result == ERR_NOT_IN_RANGE)
			result = creep.moveTo(target, MOVE_PARAMS);

		return (result == OK || result == ERR_TIRED);
	},

	/** @param {Creep} creep **/
	doUpgrade: function(creep)
	{
		const target = creep.room.controller;

		var distance = Math.max(Math.abs(target.pos.x - creep.pos.x), Math.abs(target.pos.y - creep.pos.y));

		var result = ERR_NOT_IN_RANGE;
		if (distance <= 2)
			result = creep.upgradeController(target);

		if (result == ERR_NOT_IN_RANGE)
			result = creep.moveTo(target, MOVE_PARAMS);

		return (result == OK || result == ERR_TIRED);
	},

	/** @param {Creep} creep **/
	doWithdraw: function(creep)
	{
		var target = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
			filter: (structure) => structure.store[RESOURCE_ENERGY] != 0
		});

		if (target != null)
		{
			console.log("Creep " + creep.name + " withdrap tombstone " + target);

			var result = creep.withdraw(target, RESOURCE_ENERGY);
			if (result == ERR_NOT_IN_RANGE)
				result = creep.moveTo(target, MOVE_PARAMS);

			return (result == OK || result == ERR_TIRED);
		}

		target = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
		if (target == null)
			return false;

		console.log("Creep " + creep.name + " pickup dropped energy " + target);

		var result = creep.pickup(target);
		if (result == ERR_NOT_IN_RANGE)
			result = creep.moveTo(target, MOVE_PARAMS);

		return (result == OK || result == ERR_TIRED);
	},

	/** @param {Creep} creep **/
	doRole: function(creep)
	{
		return false;
	},

	/** @param {Creep} creep **/
	doActions: function(creep)
	{
		if (creep.getActiveBodyparts(CLAIM) != 0)
			return;

		if (CreepModule.doRole(creep))
			return;

		CreepModule.updateState(creep);

//		console.log("Creep " + creep.name + " state = " + creep.memory.state);

		var result = false;
		switch (creep.memory.state)
		{
			case CreepModule.State.HARVESTING:
				result = CreepModule.doHarvest(creep);
				break;
			case CreepModule.State.BUILDING:
				result = CreepModule.doBuild(creep);
				break;
			case CreepModule.State.TRANSFERRING:
				result = CreepModule.doTransfer(creep);
				break;
			case CreepModule.State.UPGRADING:
				result = CreepModule.doUpgrade(creep);
				break;
		}

		if (!result)
			CreepModule.resetState(creep);
	},

	checkDead: function()
	{
		for (var name in Memory.creeps)
		{
			if (Game.creeps[name] !== undefined)
				continue;

			var sourceId = Memory.creeps[name].sourceId;
			if (sourceId !== undefined)
				Memory.sourcesQueue[sourceId]--;

			delete Memory.creeps[name];
		}
	},

	/** @param {Room} room **/
	spawnCreeps: function(room)
	{
		var creeps = room.find(FIND_MY_CREEPS);
		if (creeps.length >= 15)
			return;

		var creeps_length = creeps.length;

		var spawns = room.find(FIND_MY_SPAWNS);
		for (var i = 0; i < spawns.length && creeps_length < 10; i++)
		{
			var spawn = spawns[i];
			if (spawn.spawning != null)
				continue;

			// Game.spawns["Spawn1"].spawnCreep([CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE], "Claimer1")
			var name = "Creep_" + Memory.creepId;
			if (spawn.spawnCreep([WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], name) != OK)
				continue;

			spawn.room.visual.text("🛠 spawn", spawn.pos.x + 1, spawn.pos.y, {align: 'left', opacity: 0.8});
			console.log("Spawning new creep: " + name);

			Memory.creepId++;
			creeps_length++;
		}
	},

	initQueue: function()
	{
		if (Memory.creepId === undefined)
			Memory.creepId = 1;

		if (Memory.sourcesQueue === undefined)
			Memory.sourcesQueue = {};

		for (var name in Game.rooms)
		{
			var sources = Game.rooms[name].find(FIND_SOURCES);

			for (var i = 0; i < sources.length; i++)
			{
				var source = sources[i].id;

				if (Memory.sourcesQueue[source] !== undefined)
					continue;
				Memory.sourcesQueue[source] = 0;
			}
		}
	},

	run: function()
	{
		CreepModule.initQueue();
		CreepModule.checkDead();

		for (var name in Game.rooms)
			CreepModule.spawnCreeps(Game.rooms[name]);

		for (var name in Game.creeps)
			CreepModule.doActions(Game.creeps[name]);
	}
};

module.exports = CreepModule;