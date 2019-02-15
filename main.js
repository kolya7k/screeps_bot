var CreepModule = require('CreepModule');
var TowerModule = require('TowerModule');

module.exports.loop = function()
{
	CreepModule.run();
	TowerModule.run();
}