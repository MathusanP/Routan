const { InteractionType } = require('discord.js');

module.exports = {
	name: 'interactionCreate',
	once: false,

	execute: async (interaction, client) => {
		/* Handle Slash Commands */
		if (interaction.type === InteractionType.ApplicationCommand) {
			await interaction.deferReply();

			const cmd = client.commands.get(interaction.commandName);
			if (!cmd) return;

			/* Is the command working? */
			if (cmd['error'] == true) {
				interaction.followUp({
					content: 'Sorry, this command is currently not released yet, please check another time.',
					ephemeral: true
				});
				return;
			}

			/* Permission check */
			if (cmd['permissions'] != []) {
				for (const permission of cmd['permissions']) {
					if (!interaction.member.permissions.has(permission.replace(' ', '_').toUpperCase())) {
						interaction.followUp({
							content: 'Sorry, you do not have permission to run this command.',
							ephemeral: true
						});
						return;
					}
				}
			}

			/* Guild-only check */
			if (cmd['guildOnly'] == true) {
				if (!interaction.member.id == interaction.guild.ownerId) {
					interaction.followUp({
						content: 'Sorry, this command can only be used within a server.',
						ephemeral: true
					});
					return;
				}
			}

			/* Owner-only check */
			if (cmd['ownerOnly'] == true) {
				if (!interaction.member.id == interaction.guild.ownerId) {
					interaction.followUp({
						content: 'Sorry, only the server owner can run this command.',
						ephemeral: true
					});
					return;
				}
			}

			/* Execute the command file */
			await cmd.execute({ interaction, client });
			return;
		}

		/* Handle Select Menus */
		if (interaction.isStringSelectMenu()) {
			if (interaction.customId === 'stationSelect') {
				const stationCommand = client.commands.get('station');
				if (stationCommand?.handleSelectMenu) {
					await stationCommand.handleSelectMenu(interaction);
				}
			}
		}
	}
};
