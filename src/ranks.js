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

export const GRADE = {
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
