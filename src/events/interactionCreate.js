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
			if (cmd.error === true) {
				await interaction.followUp({
					content: 'Sorry, this command is currently not released yet, please check another time.',
					ephemeral: true
				});
				return;
			}

			/* Permission check */
			if (cmd.permissions && cmd.permissions.length > 0) {
				for (const permission of cmd.permissions) {
					if (!interaction.member.permissions.has(permission.replace(' ', '_').toUpperCase())) {
						await interaction.followUp({
							content: 'Sorry, you do not have permission to run this command.',
							ephemeral: true
						});
						return;
					}
				}
			}



			/* Execute the command file */
			await cmd.execute({ interaction, client });
			return;
		}

		/* Handle Select Menus */
		if (interaction.isStringSelectMenu()) {
			const customId = interaction.customId;

			if (customId === 'stationSelect') {
				const stationCommand = client.commands.get('station');
				if (stationCommand?.handleSelectMenu) {
					await stationCommand.handleSelectMenu(interaction);
				}
			}

			else if (customId === 'nextTrainSelect') {
				const trainCommand = client.commands.get('nexttrain');
				if (trainCommand?.handleSelectMenu) {
					await trainCommand.handleSelectMenu(interaction);
				}
			}
		}

	}
};
