import axios from 'axios'
import mysql from 'mysql2'
import qs from 'qs'
import { Fields } from '../../recruitment-forms.js'

const answerToSQLBool = (answer) => toSQLBool(answer.toLowerCase() === 'o')
const toSQLBool = (condition) => (condition ? 1 : 0)
const SQLBoolToAnswer = (bool) => (bool === 1 ? 'Oui' : 'Non')

const getForumInfo = (discordId) =>
	`SELECT u.user_id, u.username, p.dob_day, p.dob_month, p.dob_year
    FROM xf_user as u
    INNER JOIN xf_user_profile as p
    ON u.user_id = p.user_id
    WHERE discord_id = ${mysql.escape(discordId)}`

const getForumId = (discordId) =>
	`SELECT user_id
    FROM xf_user
    WHERE discord_id = ${mysql.escape(discordId)}`

const part1 = (requesterId, data) => {
	const connection = mysql.createConnection({
		host: 'localhost',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWD,
		database: process.env.DB_NAME,
	})

	return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) {
				reject('Erreur de connexion à la base de données. CODE R33')
				return
			}

			connection.query(getForumInfo(requesterId), (err, result) => {
				if (err || !result || !result[0]) {
					if (err) console.error(err.toString())
					reject('Une erreur est survenue. Peut-être que votre compte Discord n\'est pas lié au forum. CODE R40')
					return
				}

				const userInfo = result[0]

				connection.query(
					`INSERT INTO infos_recrutement
                            (
                                form1_complete,
                                user_id,
                                discord_username,
                                pseudo,
                                commando_name,
                                birthdate,
                                game_style,
                                platform,
                                platform_username,
								first_name
                            )
                        VALUES (
                            1,
                            ${userInfo.user_id},
                            ${mysql.escape(data[Fields.DISCORD_USERNAME])},
                            ${mysql.escape(userInfo.username)},
                            ${mysql.escape(data[Fields.COMMANDO_NAME])},
                            '${userInfo.dob_day}/${userInfo.dob_month}/${userInfo.dob_year}',
                            ${mysql.escape(data[Fields.GAME_STYLE])},
                            ${mysql.escape(data[Fields.MAIN_PLATFORM])},
                            ${mysql.escape(data[Fields.PLATFORM_USERNAME])},
                            ${mysql.escape(data[Fields.FIRSTNAME])}
                        );`,
					(err, result) => {
						if (err) {
							reject("Code R74 - " + err.toString())
							return
						}

						if (!result || result.affectedRows === 0) {
							reject("R79")
							return
						}

						resolve(`<@${requesterId}>, formulaire 1/3 complété.`)
					}
				)
			})
		})
	})
}

const part2 = (requesterId, data) => {
	const connection = mysql.createConnection({
		host: 'localhost',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWD,
		database: process.env.DB_NAME,
	})

	return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) {
				reject('Erreur de connexion à la base de données')
				return
			}

			connection.query(
				`UPDATE infos_recrutement
                SET
                    form2_complete = 1,
                    can_be_present = ${answerToSQLBool(data[Fields.CAN_BE_PRESENT])},
                    can_pay = ${answerToSQLBool(data[Fields.CAN_PAY])},
                    how_know_us = ${mysql.escape(data[Fields.HOW_KNOW_US])},
					comment = ${mysql.escape(data[Fields.COMMENT])}
                WHERE
                    user_id = (${getForumId(requesterId)}) AND
                    form1_complete = 1 AND
                    form2_complete = 0 AND
					form3_complete = 0;`,
				(err, result) => {
					if (err) {
						console.error(err.toString())
						reject('Une erreur est survenue. CODE R120')
						return
					}

					if (!result || result.affectedRows === 0 || result.changedRows === 0) {
						reject(
							"L'opération ne peut pas être complétée. Le formulaire a certainement déjà été rempli. CODE R126"
						)
						return
					}

					resolve(`<@${requesterId}>, formulaire 2/3 complété.`)
				}
			)
		})
	})
}

const part3 = (requesterId, data) => {
	const connection = mysql.createConnection({
		host: 'localhost',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWD,
		database: process.env.DB_NAME,
	})

	return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) {
				reject('Erreur de connexion à la base de données')
				return
			}

			connection.query(
				`UPDATE infos_recrutement
                SET
                    form3_complete = 1,
                    skills_dev = ${answerToSQLBool(data[Fields.SKILLS_DEV])},
                    skills_design = ${answerToSQLBool(data[Fields.SKILLS_DESIGN])},
                    skills_video = ${answerToSQLBool(data[Fields.SKILLS_VIDEO])}
                WHERE
                    user_id = (${getForumId(requesterId)}) AND
                    form1_complete = 1 AND
                    form2_complete = 1 AND
					form3_complete = 0;`,
				(err, result) => {
					if (err) {
						console.error(err.toString())
						reject('Une erreur est survenue. CODE R170')
						return
					}

					if (!result || result.affectedRows === 0 || result.changedRows === 0) {
						reject(
							"L'opération ne peut pas être complétée. Le formulaire a certainement déjà été rempli. CODE R176"
						)
						return
					}

					postRecruitmentForm(requesterId, connection, resolve, reject)
						.then((res) => {
							const { user_id, thread_id, view_url } = res
							const message = `<@${requesterId}>, formulaire 3/3 complété.\nVotre fiche a été postée.\nVous pouvez la consulter à cette adresse : ${view_url}`

							connection.query(
								`UPDATE infos_recrutement
                                SET
                                    post_id = ${thread_id}
                                WHERE
                                    user_id = (${user_id})`,
								(err, result) => {
									if (err) {
										console.error(err.toString())
										reject('Une erreur est survenue. CODE R195')
										return
									}

									if (
										!result ||
										result.affectedRows === 0 ||
										result.changedRows === 0
									) {
										reject('Une erreur est survenue. CODE R204')
										return
									}

									resolve(message)
									return
								}
							)
						})
						.catch(reject)
				}
			)
		})
	})
}

const buildMessage = ({
	discord_username,
	platform_username,
	birthdate,
	can_be_present,
	can_pay,
	how_know_us,
	comment,
	platform,
  first_name,
	pseudo,
	commando_name,
	game_style,
	skills_dev,
	skills_design,
	skills_video
}) =>
	`[HEADING=2][u]QUESTIONNAIRE POUR BATTLEFIELD 6[/u][/HEADING]
    
    [b]Prénom[/b] : ${first_name}
    [b]Date d'anniversaire[/b] : ${birthdate}
    [b]Date de votre arrivée dans le CK[/b] : ${new Date().toLocaleDateString('fr')}
    [b]Plateforme principale[/b] : ${platform}
    [b]Votre pseudo de jeu avant de rejoindre le Commando Kieffer[/b] : ${pseudo}
    [b]Votre nouveau pseudo choisi dans la liste du Commando Kieffer[/b] : ${commando_name}
    [b]Style de jeu, armes favorites[/b] : ${game_style}

    [u][b]Différentes compétences[/b][/u]
    [b]Programmation[/b] : ${SQLBoolToAnswer(skills_dev)}
    [b]Design[/b] : ${SQLBoolToAnswer(skills_design)}
    [b]Montage vidéo[/b] : ${SQLBoolToAnswer(skills_video)}

    [u][b]Identifiants[/b][/u]
    [b]Discord[/b] : ${discord_username}
    [b]Plateforme principale[/b] : ${platform_username}

    [b]Pouvez vous être présent le vendredi soir de 20h45 à 23h ?[/b] : ${SQLBoolToAnswer(
		can_be_present
	)}
    [b]Pouvez vous payer la cotisation annuelle de 10€ ?[/b] : ${SQLBoolToAnswer(can_pay)}
    [b]Comment avez vous connu le Commando Kieffer ?[/b] : ${how_know_us}
    [b]Avez vous un commentaire à formuler ?[/b] : ${comment}
`

const postRecruitmentForm = (discordId, connection) =>
	new Promise((resolve, reject) => {
		connection.query(
			`SELECT u.user_id as userId, r.*
        FROM xf_user AS u
        INNER JOIN infos_recrutement AS r ON u.user_id = r.user_id
        WHERE discord_id = ${mysql.escape(
			discordId
		)} AND r.form1_complete = 1 AND r.form2_complete = 1 AND r.form3_complete = 1`,
			(err, result) => {
				if (err || !result || !result[0]) {
					reject('Error')
					return
				}

				const data = result[0]
				const title = `[${data.commando_name.toUpperCase()} - EN FORMATION]`
				const message = buildMessage(data)

				const payload = {
					node_id: 35,
					prefix_id: 15,
					discussion_type: 'discussion',
					sticky: false,
					discussion_open: true,
					title,
					message,
				}

				axios
					.post(process.env.CK_FORUM_API + '/threads', qs.stringify(payload), {
						headers: {
							'content-type': 'application/x-www-form-urlencoded',
							'XF-Api-Key': process.env.CK_FORUM_API_KEY,
							'XF-Api-User': data.userId,
						},
					})
					.then((response) => {
						resolve(response.data.thread)
						return
					})
					.catch((error) => {
						console.log(error.response.data.errors)
						reject("La fiche n'a pas pu être postée. CODE R307")
						return
					})
			}
		)
	})

export default { part1, part2, part3 }
