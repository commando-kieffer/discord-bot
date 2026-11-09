// Troops, bordées et grades : tout ce qui sert à construire les pseudos et les rôles des membres

export const TROOP = {
	T1: 't1',
	T2: 't2',
	T3: 't3',
	T8: 't8',
	T9: 't9',
	TQG: 'tqg',
}

export const BORDEE = {
	B1: 'b1',
	B2: 'b2',
}

export const TROOP_LABELS = {
	[TROOP.T1]: 'Troop 1',
	[TROOP.T2]: 'Troop 2',
	[TROOP.T3]: 'Troop 3',
	[TROOP.T8]: 'Troop 8',
	[TROOP.T9]: 'Troop 9 (KG)',
	[TROOP.TQG]: 'Troop QG',
}

export const BORDEE_LABELS = {
	[BORDEE.B1]: 'Bordée 1',
	[BORDEE.B2]: 'Bordée 2',
}

export const GRADE = {
	RECRUE: 'Recrue',
	CADET: 'Cadet',
}

// Limite imposée par Discord sur les pseudos de serveur
export const NICK_MAX_LENGTH = 32

export const isTroop = (value) => Object.values(TROOP).includes(value)
export const isBordee = (value) => Object.values(BORDEE).includes(value)

export const getTroopAlias = (troop) => {
	switch (troop) {
		case TROOP.T1:
			return '1'
		case TROOP.T8:
			return '8'
		case TROOP.T2:
			return '2'
		case TROOP.T3:
			return '3'
		case TROOP.T9:
			return 'KG'
		case TROOP.TQG:
			return 'QG'
		default:
			return null
	}
}

export const getBordeeAlias = (bordee) => {
	switch (bordee) {
		case BORDEE.B1:
			return '1'
		case BORDEE.B2:
			return '2'
		default:
			return ''
	}
}

// T2 et T3 n'ont pas de rôle Discord : on renvoie 0 comme avant
export const getTroopDiscordRole = (troop, roles) => roles.troops[troop]?.role || 0

export const buildNick = (grade, nom, troop) => `${grade}.${nom}-${getTroopAlias(troop)}Fsl`

export const buildFormerNick = (name, joinedAt) =>
	`Ex ${name} ${new Date(joinedAt).toLocaleDateString('fr').replaceAll('/', ' ')}`

export const extractCommandoName = (nick) => {
	// cancer à comprendre pour les non-initiés
	// c'est une regex qui sert à sortir le nom de commando du nom complet discord
	// exemple : Lv.Ohliger-1Cmd ==> Ohliger
	const match = /(?:[a-z0-9]*.)([\p{L} '-]*)(?:-)(?:[1238]|(KG)|(QG))(?:[a-z]*)/iu.exec(nick ?? '')
	return match && match[1] ? match[1] : null
}

const NAME_PATTERN = /^\p{L}[\p{L} '-]*\p{L}$/u

export const isValidCommandoName = (nom) =>
	typeof nom === 'string' && nom.length <= 20 && NAME_PATTERN.test(nom)

// Rôles Discord liés à la troop et à la bordée (aucun pour T2 et T3)
const troopDiscordRoles = (troop, bordee, roles) => {
	const troopRoles = roles.troops[troop]
	if (!troopRoles) return []
	return [troopRoles.role, bordee === BORDEE.B1 ? troopRoles.b1 : troopRoles.b2]
}

export const getInitialRoles = (troop, bordee, { roles, forumGroups }) => {
	if (!isTroop(troop)) return []

	const discordRoles = [roles.cadet, roles.membreEquipage, ...troopDiscordRoles(troop, bordee, roles)]
	const forumRoles = [forumGroups.speFsl, forumGroups.membreEquipage]

	if (forumGroups.troops[troop]) {
		forumRoles.push(forumGroups.troops[troop], bordee === BORDEE.B1 ? forumGroups.b1 : forumGroups.b2)
	}

	return [discordRoles, forumRoles]
}

// Une recrue a les mêmes rôles Discord qu'un cadet, avec le grade de recrue, et rien sur le forum
export const getRecruitRoles = (troop, bordee, roles) => {
	if (!isTroop(troop)) return []
	return [roles.recrue, roles.membreEquipage, ...troopDiscordRoles(troop, bordee, roles)]
}

// Rôles qui montrent que la personne fait déjà partie du CK
export const getUnitRoles = (roles) =>
	[
		roles.em,
		roles.qm1,
		roles.qm2,
		roles.cadet,
		roles.recrue,
		roles.instructeur,
		roles.recruteur,
		roles.membreEquipage,
		...Object.values(roles.troops).flatMap(({ role, b1, b2 }) => [role, b1, b2]),
	].filter(Boolean)

// Où en est un membre : civil, recrue (en test) ou déjà cadet ou plus
export const STAGE = {
	CIVIL: 'civil',
	RECRUE: 'recrue',
	MEMBER: 'member',
}

export const getStage = (memberRoles, roles) => {
	const has = (role) => Boolean(role) && (memberRoles ?? []).includes(role)

	// Une recrue a les rôles d'équipage et de troop, mais aucun de ceux-ci
	if ([roles.cadet, roles.instructeur, roles.recruteur, roles.qm1, roles.qm2, roles.em].some(has)) return STAGE.MEMBER
	if (has(roles.recrue)) return STAGE.RECRUE
	if (getUnitRoles(roles).some(has)) return STAGE.MEMBER

	return STAGE.CIVIL
}

// Valeurs déjà connues d'un membre (pseudo et rôles), pour pré-remplir les formulaires
export const findRankDefaults = (member, roles) => {
	const memberRoles = member?.roles ?? []
	const defaults = { name: null, troop: null, bordee: null }

	const name = extractCommandoName(member?.nick)
	if (name && isValidCommandoName(name)) defaults.name = name

	for (const [troop, { role, b1, b2 }] of Object.entries(roles.troops)) {
		if (!role || !memberRoles.includes(role)) continue
		defaults.troop = troop
		if (b1 && memberRoles.includes(b1)) defaults.bordee = BORDEE.B1
		else if (b2 && memberRoles.includes(b2)) defaults.bordee = BORDEE.B2
		break
	}

	return defaults
}
