import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } from 'discord.js';
import axios from 'axios';
import 'dotenv/config';

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const WORKER_URL = process.env.CF_WORKER_URL!;
const API_SECRET = process.env.API_SECRET!;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 1. Define Commands
const commands = [
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new novel/manga to the tracker')
    .addStringOption(opt => opt.setName('title').setDescription('The title').setRequired(true))
    .addStringOption(opt => opt.setName('category').setDescription('novel, manga, etc').setRequired(true))
    .addStringOption(opt => opt.setName('status').setDescription('Reading, Completed, etc').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot status')
    .toJSON(),
];

// 2. Register Commands
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🚀 Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Commands registered.');
  } catch (error) {
    console.error(error);
  }
})();

// 3. Event Listeners
client.once(Events.ClientReady, c => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('🏓 Pong! I am alive.');
  }

  if (interaction.commandName === 'add') {
    await interaction.deferReply();
    
    const title = interaction.options.getString('title');
    const category = interaction.options.getString('category');
    const status = interaction.options.getString('status');

    try {
      // 4. POST to CF Worker
      const response = await axios.post(WORKER_URL, {
        title,
        category,
        status,
        author: interaction.user.username
      }, {
        headers: { 'Authorization': `Bearer ${API_SECRET}` }
      });

      await interaction.editReply(`✅ Added **${title}**! Check the site.`);
    } catch (err: any) {
      console.error(err.response?.data || err.message);
      await interaction.editReply('❌ Failed to add. Check bot logs.');
    }
  }
});

client.login(TOKEN);
