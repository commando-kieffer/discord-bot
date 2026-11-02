export const ROLE = {
	ALL: 0b00000,
	RECRUIT: 0b00001,
	INSTRUCTEURS: 0b00011,
	QM: 0b00111,
	EM: 0b01111,
}

// `roles` vient de la config (identifiants des rôles du serveur), `memberRoles` de l'interaction Discord
export function hasAccess(level, memberRoles, roles) {
	const has = (role) => Boolean(role) && (memberRoles ?? []).includes(role)

	switch (level) {
		case ROLE.ALL:
			return true
		case ROLE.RECRUIT:
			return has(roles.recruiting)
		case ROLE.INSTRUCTEURS:
			return has(roles.instructeur) || has(roles.recruteur) || hasAccess(ROLE.QM, memberRoles, roles)
		case ROLE.QM:
			return has(roles.qm1) || has(roles.qm2) || hasAccess(ROLE.EM, memberRoles, roles)
		case ROLE.EM:
			return has(roles.em)
		default:
			return false
	}
}
