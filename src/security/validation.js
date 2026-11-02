// Les identifiants Discord (snowflakes) finissent dans des URL de l'API : on ne laisse passer que des chiffres
const SNOWFLAKE = /^\d{17,20}$/

export const isSnowflake = (value) => typeof value === 'string' && SNOWFLAKE.test(value)

export function assertSnowflake(value, label = 'identifiant') {
	if (!isSnowflake(value)) {
		throw new TypeError(`${label} Discord invalide : ${JSON.stringify(value)}`)
	}
	return value
}

// Identifiant de compte forum (xf_user.user_id), reçu en texte depuis un formulaire ou en nombre depuis une commande
export const parseForumId = (value) => {
	const text = String(value ?? '').trim()
	if (!/^\d{1,10}$/.test(text)) return null
	const id = Number(text)
	return id > 0 ? id : null
}
