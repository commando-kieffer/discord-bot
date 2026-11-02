import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	BORDEE,
	GRADE,
	TROOP,
	buildFormerNick,
	buildNick,
	extractCommandoName,
	getBordeeAlias,
	getInitialRoles,
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
	it('construit le pseudo de cadet', () => {
		assert.equal(buildNick(GRADE.CADET, 'Kieffer', TROOP.T1), 'Cadet.Kieffer-1Fsl')
		assert.equal(buildNick(GRADE.CADET, 'Guy', TROOP.T9), 'Cadet.Guy-KGFsl')
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
})
