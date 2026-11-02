import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { loadConfig } from '../../src/config.js'

export const ids = {
	app: '200000000000000001',
	guild: '200000000000000002',
	homeChannel: '200000000000000003',
	requester: '100000000000000001',
	target: '100000000000000002',
	protected: '224193244555116545',
	roles: {
		em: '300000000000000001',
		qm1: '300000000000000002',
		qm2: '300000000000000003',
		cadet: '300000000000000004',
		instructeur: '300000000000000005',
		recruteur: '300000000000000006',
		membreEquipage: '300000000000000007',
		civil: '300000000000000008',
		civilEnAttente: '300000000000000009',
		ancienCommando: '300000000000000010',
		recruiting: '300000000000000011',
		t1: '300000000000000101',
		t1b1: '300000000000000102',
		t1b2: '300000000000000103',
		t8: '300000000000000201',
		t8b1: '300000000000000202',
		t8b2: '300000000000000203',
		t9: '300000000000000301',
		t9b1: '300000000000000302',
		t9b2: '300000000000000303',
		tqg: '300000000000000401',
		tqgb1: '300000000000000402',
		tqgb2: '300000000000000403',
	},
}

export const testEnv = (overrides = {}) => ({
	APP_ID: ids.app,
	GUILD_ID: ids.guild,
	DISCORD_TOKEN: 'discord-token',
	PUBLIC_KEY: 'ab'.repeat(32),
	HOME_CHANNEL: ids.homeChannel,
	CK_DISCORD_ROOT: 'https://discord.commandokieffer.com',
	EM_ROLE: ids.roles.em,
	QM1_ROLE: ids.roles.qm1,
	QM2_ROLE: ids.roles.qm2,
	CADET_ROLE: ids.roles.cadet,
	INSTRUCTEUR_ROLE: ids.roles.instructeur,
	RECRUTEUR_ROLE: ids.roles.recruteur,
	MEMBRE_EQUIPAGE_ROLE: ids.roles.membreEquipage,
	CIVIL_ROLE: ids.roles.civil,
	CIVIL_EN_ATTENTE_ROLE: ids.roles.civilEnAttente,
	ANCIEN_COMMANDO_ROLE: ids.roles.ancienCommando,
	RECRUITING_ROLE: ids.roles.recruiting,
	T1_ROLE: ids.roles.t1,
	T1_B1_ROLE: ids.roles.t1b1,
	T1_B2_ROLE: ids.roles.t1b2,
	T8_ROLE: ids.roles.t8,
	T8_B1_ROLE: ids.roles.t8b1,
	T8_B2_ROLE: ids.roles.t8b2,
	T9_ROLE: ids.roles.t9,
	T9_B1_ROLE: ids.roles.t9b1,
	T9_B2_ROLE: ids.roles.t9b2,
	TQG_ROLE: ids.roles.tqg,
	TQG_B1_ROLE: ids.roles.tqgb1,
	TQG_B2_ROLE: ids.roles.tqgb2,
	T1_ROLE_FORUM: '38',
	T8_ROLE_FORUM: '39',
	T9_ROLE_FORUM: '40',
	TQG_ROLE_FORUM: '41',
	B1_ROLE_FORUM: '52',
	B2_ROLE_FORUM: '53',
	CADET_ROLE_FORUM: '5',
	CIVIL_ROLE_FORUM: '2',
	MEMBRE_EQUIPAGE_ROLE_FORUM: '42',
	SPE_FSL_ROLE_FORUM: '30',
	DB_NAME: 'ck',
	DB_USER: 'bot',
	DB_PASSWD: 'secret',
	CK_FORUM_API: 'https://forum.commandokieffer.com/index.php/api',
	CK_FORUM_API_KEY: 'forum-key',
	...overrides,
})

export const testConfig = (overrides) => loadConfig(testEnv(overrides))

// Logger qui garde les entrées en mémoire pour pouvoir les vérifier
export function createTestLogger() {
	const entries = []
	const make = (scope) => {
		const log = (level) => (message, context) => entries.push({ level, scope, message, context })
		return {
			level: 'debug',
			debug: log('debug'),
			info: log('info'),
			warn: log('warn'),
			error: log('error'),
			child: (child) => make(scope ? `${scope}:${child}` : child),
		}
	}
	return Object.assign(make(''), { entries })
}

export const sqlError = (code, message = code) => Object.assign(new Error(message), { code })

// Base de données factice : chaque requête doit correspondre à la prochaine réponse programmée
export function createFakeDb(script = []) {
	const queue = [...script]
	const calls = []
	return {
		calls,
		get remaining() {
			return queue.length
		},
		async query(sql, params) {
			calls.push({ sql, params })
			const next = queue.shift()
			assert.ok(next, `requête inattendue : ${sql}`)
			const [pattern, result] = next
			assert.match(sql, pattern)
			if (result instanceof Error) throw result
			return typeof result === 'function' ? result(params) : result
		},
	}
}

const fns = (defaults, overrides) =>
	Object.fromEntries(
		Object.entries({ ...defaults, ...overrides }).map(([name, impl]) => [name, mock.fn(impl)])
	)

export function createFakeDiscord(overrides = {}) {
	return fns(
		{
			getMember: async () => ({ nick: null, roles: [], joined_at: '2024-01-02T10:00:00.000Z' }),
			updateMember: async () => ({}),
			listMembers: async () => [],
			sendMessage: async () => ({ id: '1' }),
			openDirectMessage: async () => ({ id: '400000000000000001' }),
			listCommands: async () => [],
			createCommand: async () => ({}),
			editCommand: async () => ({}),
			deleteCommand: async () => ({}),
		},
		overrides
	)
}

export function createFakeForum({ users = {}, link = {}, recruitment = {}, complaints = {} } = {}) {
	return {
		users: fns(
			{
				last: async () => [],
				info: async () => null,
				setRoles: async () => 'Les permissions de base ont été correctement attribuées.',
				getUsername: async () => ({ platform_username: 'Pseudo#1234' }),
			},
			users
		),
		link: fns({ link: async () => true }, link),
		recruitment: fns(
			{
				part1: async (id) => `<@${id}>, formulaire 1/3 complété.`,
				part2: async (id) => `<@${id}>, formulaire 2/3 complété.`,
				part3: async (id) => `<@${id}>, formulaire 3/3 complété.`,
			},
			recruitment
		),
		complaints: fns({ send: async () => {} }, complaints),
	}
}

export const callsOf = (fn) => fn.mock.calls.map((call) => call.arguments)
