var _ = require('lodash');

var TowerModule =
{
	/** @param {StructureTower} tower **/
	doActions: function(tower)
	{
		var hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
		if (hostile != null)
		{
			tower.attack(hostile);
			return;
		}

		var creeps = tower.room.find(FIND_MY_CREEPS, {
			filter: (creep) => creep.hits < creep.hitsMax
		});
		var creep = _.reduce(creeps, function(last, cur) {
			var damageLast = last.hits / last.hitsMax;
			var damageCur = cur.hits / cur.hitsMax;
			return damageLast > damageCur ? last : cur;
		});
		if (creep != null)
		{
			tower.heal(creep);
			return;
		}

		var damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, {
			filter: function(structure) {
				if (structure.hits >= structure.hitsMax)
					return false;
				if (structure.my !== undefined && !structure.my)
					return false;
				if (structure.structureType == STRUCTURE_WALL && structure.hits >= 100000)
					return false;
				if (structure.structureType == STRUCTURE_ROAD)
					return false;
				return true;
			}
		});
		if (damaged != null)
		{
			tower.repair(damaged);
			return;
		}
	},

	run: function(tower)
	{
		for (var name in Game.structures)
		{
			var structure = Game.structures[name];
			if (structure.structureType != STRUCTURE_TOWER)
				continue;

			TowerModule.doActions(structure);
		}
	}
};

module.exports = TowerModule;