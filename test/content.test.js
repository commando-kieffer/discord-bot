import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { ContentError, REQUIRED_LINKS, fillTemplate, loadContent, validateContent } from '../src/content.js'

const validContent = () => ({
	game: 'Arma Reforger',
	links: Object.fromEntries(
		Object.entries(REQUIRED_LINKS).map(([name, placeholders]) => [
			name,
			`https://example.com/${name}${placeholders.map((p) => `/{${p}}`).join('')}`,
		])
	),
	websites: [{ title: 'Sites', groups: [[{ label: 'Accueil', url: 'https://commandokieffer.com' }]] }],
	spe: ['# Spé', '', 'texte'],
})

describe('data/content.json', () => {
	it('le fichier livré est valide', () => {
		const content = loadContent()
		assert.equal(typeof content.game, 'string')
		assert.ok(content.websites.length > 0)
		assert.ok(content.spe.length > 0)
		for (const [name, placeholders] of Object.entries(REQUIRED_LINKS)) {
			const params = Object.fromEntries(placeholders.map((p) => [p, 1]))
			assert.doesNotThrow(() => fillTemplate(content.links[name], params))
		}
	})

	it('est gelé une fois chargé', () => {
		const content = loadContent()
		assert.ok(Object.isFrozen(content.websites[0].groups[0][0]))
	})
})

describe('loadContent', () => {
	const dir = mkdtempSync(join(tmpdir(), 'ck-content-'))
	after(() => rmSync(dir, { recursive: true, force: true }))

	it('accepte un fichier enregistré avec un BOM', () => {
		const path = join(dir, 'bom.json')
		writeFileSync(path, '﻿' + JSON.stringify(validContent()))
		assert.equal(loadContent(path).game, 'Arma Reforger')
	})

	it('signale un JSON invalide', () => {
		const path = join(dir, 'broken.json')
		writeFileSync(path, '{ "game": ')
		assert.throws(() => loadContent(path), (err) => err instanceof ContentError && /Impossible de lire/.test(err.message))
	})

	it('signale un fichier absent', () => {
		assert.throws(() => loadContent(join(dir, 'absent.json')), ContentError)
	})
})

describe('validateContent', () => {
	it('accepte un contenu complet', () => {
		assert.equal(validateContent(validContent()).game, 'Arma Reforger')
	})

	it('liste tous les problèmes trouvés', () => {
		const content = validContent()
		content.game = ''
		content.websites[0].groups[0][0].url = 'http://commandokieffer.com'
		content.spe = 'texte'
		assert.throws(
			() => validateContent(content),
			(err) => {
				assert.ok(err instanceof ContentError)
				assert.match(err.message, /"game"/)
				assert.match(err.message, /websites\[0\]\.groups\[0\]\[0\]\.url/)
				assert.match(err.message, /"spe"/)
				return true
			}
		)
	})

	it('exige des liens https avec leurs paramètres', () => {
		const [name, placeholders] = Object.entries(REQUIRED_LINKS).find(([, p]) => p.length)
		const content = validContent()
		content.links[name] = 'https://example.com/sans-parametre'
		assert.throws(() => validateContent(content), new RegExp(`doit contenir \\{${placeholders[0]}\\}`))

		const other = validContent()
		other.links[name] = 'javascript:alert(1)'
		assert.throws(() => validateContent(other), /URL https/)
	})

	it('refuse des sites mal structurés', () => {
		for (const websites of [null, [{ title: 'x', groups: 'y' }], [{ title: '', groups: [[]] }], [{ title: 'x', groups: ['y'] }], [{ title: 'x', groups: [[{ label: '', url: 'https://a.b' }]] }]]) {
			assert.throws(() => validateContent({ ...validContent(), websites }), ContentError)
		}
	})

	it('refuse un contenu vide', () => {
		assert.throws(() => validateContent(null), ContentError)
	})
})

describe('fillTemplate', () => {
	it('remplace les paramètres en les encodant', () => {
		assert.equal(fillTemplate('https://zeus/profil/{userId}', { userId: 42 }), 'https://zeus/profil/42')
		assert.equal(fillTemplate('https://zeus/{a}?b={b}', { a: 'x y', b: '../' }), 'https://zeus/x%20y?b=..%2F')
	})

	it('refuse un paramètre manquant', () => {
		assert.throws(() => fillTemplate('https://zeus/profil/{userId}', {}), /Valeur manquante pour \{userId\}/)
		assert.throws(() => fillTemplate('https://zeus/profil/{userId}', { userId: null }), /Valeur manquante/)
	})
})
