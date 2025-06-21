const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'ping',
	description: 'Shows the latency for the bot',
	usage: '',

	permissions: [],
	ownerOnly: false,
	guildOnly: true,

	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Shows the latency for the bot!'),

	error: false,
	execute: ({ interaction, client }) => {

		const embed = new EmbedBuilder()
			.setTitle('Pong!')
			.setDescription(`Latency is ${client.ws.ping}ms.`)
			.setColor('Red')
			.setTimestamp();

		interaction.followUp({ embeds: [embed] });

	},
};