import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	BORDEE,
	BORDEE_LABELS,
	GRADE,
	TROOP,
	TROOP_LABELS,
	buildFormerNick,
	buildNick,
	extractCommandoName,
	findRankDefaults,
	getBordeeAlias,
	getInitialRoles,
	getRecruitRoles,
	getUnitRoles,
	getTroopAlias,
	getTroopDiscordRole,
	isBordee,
	isTroop,
	isValidCommandoName,
} from '../src/ranks.js'
import names from '../data/namesList.js'
import { ids, testConfig } from './support/fakes.js'

const config = testConfig()

describe('alias de troop et de bordée', () => {
	it('donne l\'alias utilisé dans les pseudos', () => {
		assert.deepEqual(Object.values(TROOP).map(getTroopAlias), ['1', '2', '3', '8', 'KG', 'QG'])
		assert.equal(getTroopAlias('t42'), null)
	})

	it('donne le numéro de bordée', () => {
		assert.equal(getBordeeAlias(BORDEE.B1), '1')
		assert.equal(getBordeeAlias(BORDEE.B2), '2')
		assert.equal(getBordeeAlias('b3'), '')
	})

	it('reconnaît les troops et bordées valides', () => {
		assert.ok(isTroop('tqg'))
		assert.ok(!isTroop('T1'))
		assert.ok(isBordee('b2'))
		assert.ok(!isBordee(undefined))
	})
})

describe('pseudos', () => {
	it('construit le pseudo de cadet et de recrue', () => {
		assert.equal(buildNick(GRADE.CADET, 'Kieffer', TROOP.T1), 'Cadet.Kieffer-1Fsl')
		assert.equal(buildNick(GRADE.CADET, 'Guy', TROOP.T9), 'Cadet.Guy-KGFsl')
		assert.equal(buildNick(GRADE.RECRUE, 'Kieffer', TROOP.TQG), 'Recrue.Kieffer-QGFsl')
	})

	it('retrouve le nom dans un pseudo de recrue', () => {
		assert.equal(extractCommandoName('Recrue.Kieffer-1Fsl'), 'Kieffer')
	})

	it('construit le pseudo d\'ancien commando avec la date d\'arrivée', () => {
		const joinedAt = '2024-01-02T10:00:00.000Z'
		const date = new Date(joinedAt).toLocaleDateString('fr').replaceAll('/', ' ')
		assert.equal(buildFormerNick('Ohliger', joinedAt), `Ex Ohliger ${date}`)
	})

	it('retrouve le nom de commando dans le pseudo Discord', () => {
		assert.equal(extractCommandoName('Lv.Ohliger-1Cmd'), 'Ohliger')
		assert.equal(extractCommandoName('Cadet.Kieffer-8Fsl'), 'Kieffer')
		assert.equal(extractCommandoName('Cadet.Guy-KGFsl'), 'Guy')
		assert.equal(extractCommandoName('Cadet.Hulot-QGFsl'), 'Hulot')
		assert.equal(extractCommandoName('Cadet.De Montlaur-2Fsl'), 'De Montlaur')
		assert.equal(extractCommandoName('Cadet.Cevoz-Mami-3Fsl'), 'Cevoz-Mami')
		assert.equal(extractCommandoName("Mat.Vourc'h-1Fsl"), "Vourc'h")
		assert.equal(extractCommandoName('Cadet.Salaün-1Fsl'), 'Salaün')
		assert.equal(extractCommandoName('Cadet.Bolloré-1Fsl'), 'Bolloré')
	})

	it('retrouve tous les noms de la liste officielle', () => {
		for (const name of names) {
			assert.equal(extractCommandoName(`Cadet.${name}-1Fsl`), name)
		}
	})

	it('renvoie null quand le pseudo ne suit pas le format', () => {
		assert.equal(extractCommandoName('Ex Ohliger 02 01 2024'), null)
		assert.equal(extractCommandoName('Pseudo'), null)
		assert.equal(extractCommandoName(null), null)
		assert.equal(extractCommandoName(undefined), null)
	})

	it('valide les noms de commando', () => {
		assert.ok(isValidCommandoName('Kieffer'))
		assert.ok(isValidCommandoName('De Montlaur'))
		assert.ok(isValidCommandoName("Vourc'h"))
		assert.ok(isValidCommandoName('Salaün'))
		assert.ok(!isValidCommandoName('K'))
		assert.ok(!isValidCommandoName('@everyone'))
		assert.ok(!isValidCommandoName('Nom\nAutre'))
		assert.ok(!isValidCommandoName('<@123>'))
		assert.ok(!isValidCommandoName('Nom '))
		assert.ok(!isValidCommandoName('A'.repeat(21)))
		assert.ok(!isValidCommandoName(42))
	})
})

describe('rôles', () => {
	it('donne le rôle Discord de la troop, 0 pour T2 et T3', () => {
		assert.equal(getTroopDiscordRole(TROOP.T8, config.roles), ids.roles.t8)
		assert.equal(getTroopDiscordRole(TROOP.T2, config.roles), 0)
		assert.equal(getTroopDiscordRole(TROOP.T3, config.roles), 0)
	})

	it('donne les rôles Discord et forum d\'un cadet', () => {
		assert.deepEqual(getInitialRoles(TROOP.T1, BORDEE.B1, config), [
			[ids.roles.cadet, ids.roles.membreEquipage, ids.roles.t1, ids.roles.t1b1],
			['30', '42', '38', '52'],
		])
		assert.deepEqual(getInitialRoles(TROOP.TQG, BORDEE.B2, config), [
			[ids.roles.cadet, ids.roles.membreEquipage, ids.roles.tqg, ids.roles.tqgb2],
			['30', '42', '41', '53'],
		])
		assert.deepEqual(getInitialRoles(TROOP.T9, BORDEE.B2, config)[0].slice(2), [ids.roles.t9, ids.roles.t9b2])
		assert.deepEqual(getInitialRoles(TROOP.T8, BORDEE.B1, config)[1].slice(2), ['39', '52'])
	})

	it('ne donne ni troop ni bordée pour T2 et T3', () => {
		assert.deepEqual(getInitialRoles(TROOP.T2, BORDEE.B1, config), [
			[ids.roles.cadet, ids.roles.membreEquipage],
			['30', '42'],
		])
	})

	it('ne donne rien pour une troop inconnue', () => {
		assert.deepEqual(getInitialRoles('t42', BORDEE.B1, config), [])
	})

	it('donne à une recrue les rôles Discord d\'un cadet, avec le grade de recrue', () => {
		assert.deepEqual(getRecruitRoles(TROOP.T8, BORDEE.B2, config.roles), [
			ids.roles.recrue,
			ids.roles.membreEquipage,
			ids.roles.t8,
			ids.roles.t8b2,
		])
		assert.deepEqual(getRecruitRoles(TROOP.T3, BORDEE.B1, config.roles), [ids.roles.recrue, ids.roles.membreEquipage])
		assert.deepEqual(getRecruitRoles('t42', BORDEE.B1, config.roles), [])
	})

	it('liste les rôles qui montrent qu\'on fait déjà partie du CK', () => {
		const unitRoles = getUnitRoles(config.roles)
		for (const role of [ids.roles.em, ids.roles.qm1, ids.roles.cadet, ids.roles.recrue, ids.roles.membreEquipage, ids.roles.instructeur, ids.roles.t9b1]) {
			assert.ok(unitRoles.includes(role), role)
		}
		for (const role of [ids.roles.civil, ids.roles.civilEnAttente, ids.roles.recruiting, ids.roles.ancienCommando]) {
			assert.ok(!unitRoles.includes(role), role)
		}
		assert.ok(!getUnitRoles({ ...config.roles, em: undefined }).includes(undefined))
	})
})

describe('pré-remplissage des formulaires', () => {
	it('retrouve le nom, la troop et la bordée d\'un membre', () => {
		const member = { nick: 'Recrue.Kieffer-8Fsl', roles: [ids.roles.recrue, ids.roles.t8, ids.roles.t8b2] }
		assert.deepEqual(findRankDefaults(member, config.roles), { name: 'Kieffer', troop: 't8', bordee: 'b2' })
	})

	it('laisse vide ce qui est inconnu', () => {
		assert.deepEqual(findRankDefaults({ nick: 'Pseudo', roles: [] }, config.roles), { name: null, troop: null, bordee: null })
		assert.deepEqual(findRankDefaults({ nick: 'Cadet.Kieffer-1Fsl', roles: [ids.roles.t1] }, config.roles), {
			name: 'Kieffer',
			troop: 't1',
			bordee: null,
		})
		assert.deepEqual(findRankDefaults(undefined, config.roles), { name: null, troop: null, bordee: null })
	})

	it('ignore un nom qui ne serait pas accepté par le formulaire', () => {
		assert.equal(findRankDefaults({ nick: 'Cadet.X-1Fsl', roles: [] }, config.roles).name, null)
	})

	it('a un libellé pour chaque troop et chaque bordée', () => {
		assert.deepEqual(Object.keys(TROOP_LABELS), Object.values(TROOP))
		assert.deepEqual(Object.keys(BORDEE_LABELS), Object.values(BORDEE))
	})
})
