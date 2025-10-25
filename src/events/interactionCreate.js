const { InteractionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2')
const fs = require('fs');



const pool = mysql.createPool({
	host: process.env.dbHost,
	user: process.env.dbUser,
	password: process.env.dbPassword,
	database: process.env.db,
	waitForConnections: true,
	connectionLimit: 10,
	idleTimeout: 60000,
	queueLimit: 0,
	enableKeepAlive: true,
	keepAliveInitialDelay: 0,

})


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

		if (interaction.isButton() && (interaction.customId.startsWith('favStop:'))) {

			const userId = interaction.customId.split(':')[2];
			const stopId = interaction.customId.split(':')[1];

			pool.query('SELECT isConfirmed FROM userInfo WHERE uid = ?', [userId], async (err, results) => {
				if (err) {
					console.error(`Error querying database for ${userId}`, err);
					return interaction.reply({ content: 'There was an error, if the issue persists please report this on: https://github.com/MathusanP/Routan/issues' })

				}

				if (results.length == 0) {
					const tosEmbed = new EmbedBuilder()
						.setTitle('Before you continue...')
						.setDescription(
							'Please read our [Terms of service](https://github.com/MathusanP/Routan/blob/master/.github/Terms%20of%20Service.md) and [Privacy Policy](https://github.com/MathusanP/Routan/blob/master/.github/PRIVACY_POLICY.md) and click the button to confirm that you read and agree.'
						)
						.setColor('Yellow')

					const confirmButton = new ButtonBuilder()
						.setCustomId(`confirm_${userId}`)
						.setLabel(`I understand.`)
						.setStyle(ButtonStyle.Success);

					const row = new ActionRowBuilder()
						.addComponents(confirmButton);

					return interaction.reply({ embeds: [tosEmbed], components: [row] })

				}

				pool.query(
					`INSERT INTO userFavourites(uid, stopId) VALUES (?,?) ON DUPLICATE KEY UPDATE stopId = VALUES(stopId)`, [userId, stopId], async (updateErr, result) => {
						if (updateErr) {
							console.error(`Error updating favourite stop for ${userId}`, updateErr);
							return interaction.reply({ content: 'Error saving favourite stop.', ephemeral: true });
						}

						return interaction.reply({
							content: `Your favourite stop has been saved!`,
							ephemeral: true,
						});
					}
				)


			})
		}

		if (interaction.isButton() && (interaction.customId.startsWith('confirm_'))) {
			const userId = interaction.customId.split('_')[1];

			if(interaction.user.id !== userId){
				return interaction.reply({ content: 'You cannot confirm for another user.'})
			}

			pool.query(
				'INSERT INTO userInfo(uid, isConfirmed, confirmedAt) VALUES (?, 1, NOW()) ON DUPLICATE KEY UPDATE isConfirmed = 1', [userId],
				async(err) => {
					if(err) {
						console.error(`Error inserting confirmation for ${userId}`, err)
						return interaction.reply({content: 'There was an error, if the issue persists please report this on: https://github.com/MathusanP/Routan/issues'})
					}
					await interaction.reply({content: `Thank you for confirming you can now favourite stops.`})
				}
			)

		}

	}
};
