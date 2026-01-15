import 'dotenv/config';
import fetch from 'node-fetch';
import { verifyKey } from 'discord-interactions';

export function VerifyDiscordRequest(clientKey) {
  return function (req, res, buf, encoding) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
      throw new Error('Bad request signature');
    }
  };
}

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/commando-kieffer/discord-bot, 2.1.260115)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function CKRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = process.env.CK_API + endpoint + '?token=' + process.env.CK_TOKEN;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const ROLE = {
  ALL: 0b00000,
  RECRUIT: 0b00001,
  INSTRUCTEURS: 0b00011,
  QM: 0b00111,
  EM: 0b01111
}

export function hasAccess(level, roles) {
  switch (level) {
    case ROLE.ALL: return true
    case ROLE.RECRUIT: return roles.includes(process.env.RECRUITING_ROLE)
    case ROLE.INSTRUCTEURS: return roles.includes(process.env.INSTRUCTEUR_ROLE) || roles.includes(process.env.RECRUTEUR_ROLE) || hasAccess(ROLE.QM, roles)
    case ROLE.QM: return roles.includes(process.env.QM1_ROLE) || roles.includes(process.env.QM2_ROLE) || hasAccess(ROLE.EM, roles)
    case ROLE.EM: return roles.includes(process.env.EM_ROLE)
    default: return false
  }
}
