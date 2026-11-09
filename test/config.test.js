import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ConfigError, DEFAULT_FORUM_API_USER, DEFAULT_RECRUE_ROLE, checkForumApiUrl, deepFreeze, listMissingVars, loadConfig } from '../src/config.js'
import { ids, testEnv } from './support/fakes.js'

describe('loadConfig', () => {
	it('lit toutes les variables', () => {
		const config = loadConfig(testEnv({ PORT: '4000' }))
		assert.equal(config.port, 4000)
		assert.equal(config.discord.appId, ids.app)
		assert.equal(config.discord.guildId, ids.guild)
		assert.equal(config.discord.homeChannel, ids.homeChannel)
		assert.equal(config.roles.em, ids.roles.em)
		assert.equal(config.roles.recruiting, ids.roles.recruiting)
		assert.deepEqual(config.roles.troops.t8, { role: ids.roles.t8, b1: ids.roles.t8b1, b2: ids.roles.t8b2 })
		assert.equal(config.forumGroups.troops.tqg, '41')
		assert.equal(config.forumGroups.cadet, '5')
		assert.equal(config.forum.apiKey, 'forum-key')
		assert.deepEqual(config.db, { host: 'localhost', user: 'bot', password: 'secret', database: 'ck' })
	})

	it('applique les valeurs par défaut', () => {
		const config = loadConfig(testEnv({ CK_DISCORD_ROOT: 'https://bot.example.com/', DB_HOST: undefined }))
		assert.equal(config.port, 3000)
		assert.equal(config.logLevel, 'info')
		assert.equal(config.publicUrl, 'https://bot.example.com')
		assert.equal(config.db.host, 'localhost')
	})

	it('connaît le rôle Recrue sans qu\'il soit dans le .env', () => {
		assert.equal(loadConfig(testEnv({ RECRUE_ROLE: undefined })).roles.recrue, DEFAULT_RECRUE_ROLE)
		assert.equal(DEFAULT_RECRUE_ROLE, '1318565126516772985')
		assert.equal(loadConfig(testEnv({ RECRUE_ROLE: '300000000000000099' })).roles.recrue, '300000000000000099')
	})

	it('agit sur le forum au nom du compte 33 par défaut', () => {
		assert.equal(loadConfig(testEnv()).forum.apiUser, DEFAULT_FORUM_API_USER)
		assert.equal(DEFAULT_FORUM_API_USER, '33')
		assert.equal(loadConfig(testEnv({ CK_FORUM_API_USER: '8' })).forum.apiUser, '8')
		assert.throws(() => loadConfig(testEnv({ CK_FORUM_API_USER: '8; DROP' })), /CK_FORUM_API_USER/)
	})

	it('permet de changer l\'hôte de la base', () => {
		assert.equal(loadConfig(testEnv({ DB_HOST: 'db.local' })).db.host, 'db.local')
	})

	it('refuse de démarrer sans les variables indispensables', () => {
		for (const name of ['APP_ID', 'GUILD_ID', 'DISCORD_TOKEN', 'PUBLIC_KEY']) {
			assert.throws(() => loadConfig(testEnv({ [name]: '' })), (err) => {
				assert.ok(err instanceof ConfigError)
				assert.match(err.message, new RegExp(name))
				return true
			})
		}
	})

	it('liste toutes les variables indispensables manquantes', () => {
		assert.throws(() => loadConfig({}), /APP_ID, GUILD_ID, DISCORD_TOKEN, PUBLIC_KEY/)
	})

	it('renvoie une configuration non modifiable', () => {
		const config = loadConfig(testEnv())
		assert.ok(Object.isFrozen(config))
		assert.ok(Object.isFrozen(config.roles.troops.t1))
		assert.throws(() => {
			'use strict'
			config.roles.em = 'x'
		}, TypeError)
	})
})

describe('URL de l\'API du forum', () => {
	it('accepte https et retire le / final', () => {
		assert.equal(
			checkForumApiUrl('https://forum.commandokieffer.com/index.php/api/'),
			'https://forum.commandokieffer.com/index.php/api'
		)
	})

	it('accepte http uniquement pour le forum de test et la machine locale', () => {
		assert.equal(
			checkForumApiUrl('http://forum.commandokieffer.ch/index.php/api'),
			'http://forum.commandokieffer.ch/index.php/api'
		)
		assert.equal(checkForumApiUrl('http://localhost/index.php/api'), 'http://localhost/index.php/api')
		assert.equal(checkForumApiUrl('http://127.0.0.1:8080/api'), 'http://127.0.0.1:8080/api')
	})

	it('refuse http vers le forum de production', () => {
		assert.throws(() => checkForumApiUrl('http://forum.commandokieffer.com/index.php/api'), ConfigError)
		assert.throws(() => checkForumApiUrl('http://forum.commandokieffer.ch.evil.com/api'), ConfigError)
	})

	it('refuse les autres protocoles et les URL invalides', () => {
		assert.throws(() => checkForumApiUrl('ftp://forum.commandokieffer.com'), ConfigError)
		assert.throws(() => checkForumApiUrl('forum.commandokieffer.com'), /pas une URL valide/)
	})

	it('accepte une URL absente (le forum est alors désactivé)', () => {
		assert.equal(checkForumApiUrl(undefined), '')
		assert.equal(loadConfig(testEnv({ CK_FORUM_API: '' })).forum.apiUrl, '')
	})

	it('bloque le démarrage si l\'URL est en http vers la production', () => {
		assert.throws(() => loadConfig(testEnv({ CK_FORUM_API: 'http://forum.commandokieffer.com/index.php/api' })), ConfigError)
	})
})

describe('listMissingVars', () => {
	it('liste les variables utiles absentes', () => {
		assert.deepEqual(listMissingVars(testEnv()), [])
		const missing = listMissingVars(testEnv({ HOME_CHANNEL: '', CK_FORUM_API_KEY: undefined }))
		assert.deepEqual(missing, ['HOME_CHANNEL', 'CK_FORUM_API_KEY'])
	})
})

describe('deepFreeze', () => {
	it('gèle les objets imbriqués et ignore les valeurs simples', () => {
		const value = deepFreeze({ a: { b: [1, { c: 2 }] } })
		assert.ok(Object.isFrozen(value.a.b[1]))
		assert.equal(deepFreeze(3), 3)
		assert.equal(deepFreeze(null), null)
	})
})
