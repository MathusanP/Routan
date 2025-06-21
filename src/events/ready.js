const { Collection, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');

const port = 45927

const app = require('express')();

const statusList = [
	{ type: ActivityType.Watching, message: 'trains.'},
]

function setStatus(client) {
	const status = statusList[Math.floor(Math.random() * statusList.length)];
	client.user.setPresence({
		status: 'online',
		activities: [{ type: status.type, name: status.message}]
	})
}


app.get('/', (_req, res) => res.send('Awake.'));
app.listen(port, () => console.log(`Listening to port ${port}`));

module.exports = {
	name: 'ready',
	once: true,

	execute: async (client) => {

		console.log(`Logged in as ${client.user.tag}!`);

		// Setting status
		setStatus(client);
		setInterval(() => setStatus(client), 20 * 1000);

		/* Registering slash commands */
		client.commands = new Collection();
		const data = [];

		const categories = fs.readdirSync(`${__dirname}/../commands/`);
		for (const category of categories) {
			const commandFiles = fs.readdirSync(`${__dirname}/../commands/${category}`).filter(file => file.endsWith('.js'));
			for (const file of commandFiles) {

				const command = require(`${__dirname}/../commands/${category}/${file}`);
				client.commands.set(command.name, command);
                data.push(command.data.toJSON());

			}
		}

		/* Set ApplicationCommand data */
		await client.application.commands.set(data);

	},
};
