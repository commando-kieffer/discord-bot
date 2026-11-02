import { readFileSync } from 'node:fs'
import { deepFreeze } from './config.js'

// Textes et liens affichés aux membres, modifiables sans toucher au code (redémarrer le bot après modification)
export const CONTENT_PATH = new URL('../data/content.json', import.meta.url)

export class ContentError extends Error {
	constructor(message, options) {
		super(message, options)
		this.name = 'ContentError'
	}
}

export function loadContent(path = CONTENT_PATH) {
	let content
	try {
		// Un éditeur Windows peut ajouter un BOM en tête de fichier, que JSON.parse refuse
		content = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
	} catch (err) {
		throw new ContentError(`Impossible de lire data/content.json : ${err.message}`, { cause: err })
	}
	return validateContent(content)
}

// Liens utilisés par le code, avec les valeurs à remplacer dans chacun
export const REQUIRED_LINKS = {
	zeusProfile: ['userId'],
	pointsRanking: [],
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const isHttpsUrl = (value) => {
	try {
		return new URL(value).protocol === 'https:'
	} catch {
		return false
	}
}

export function validateContent(content) {
	const problems = []
	const expect = (condition, problem) => {
		if (!condition) problems.push(problem)
	}

	expect(isNonEmptyString(content?.game), '"game" doit être le nom du jeu actuel')

	const links = content?.links ?? {}
	for (const [name, placeholders] of Object.entries(REQUIRED_LINKS)) {
		expect(isHttpsUrl(links[name]), `"links.${name}" doit être une URL https`)
		for (const placeholder of placeholders) {
			expect(String(links[name]).includes(`{${placeholder}}`), `"links.${name}" doit contenir {${placeholder}}`)
		}
	}

	if (!Array.isArray(content?.websites)) {
		problems.push('"websites" doit être une liste de sections')
	} else {
		content.websites.forEach((section, i) => {
			expect(isNonEmptyString(section?.title), `"websites[${i}].title" est vide`)
			if (!Array.isArray(section?.groups)) {
				problems.push(`"websites[${i}].groups" doit être une liste de groupes de liens`)
				return
			}
			section.groups.forEach((group, j) => {
				if (!Array.isArray(group)) {
					problems.push(`"websites[${i}].groups[${j}]" doit être une liste de liens`)
					return
				}
				group.forEach((link, k) => {
					const where = `websites[${i}].groups[${j}][${k}]`
					expect(isNonEmptyString(link?.label), `"${where}.label" est vide`)
					expect(isHttpsUrl(link?.url), `"${where}.url" doit être une URL https`)
				})
			})
		})
	}

	expect(
		Array.isArray(content?.spe) && content.spe.every((line) => typeof line === 'string'),
		'"spe" doit être une liste de lignes de texte'
	)

	if (problems.length) {
		throw new ContentError(`data/content.json invalide :\n- ${problems.join('\n- ')}`)
	}

	return deepFreeze(content)
}

export function fillTemplate(template, params) {
	return template.replace(/\{(\w+)\}/g, (placeholder, key) => {
		if (params[key] === undefined || params[key] === null) {
			throw new Error(`Valeur manquante pour ${placeholder} dans ${template}`)
		}
		return encodeURIComponent(String(params[key]))
	})
}
