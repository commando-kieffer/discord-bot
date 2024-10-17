import mysql from "mysql2"

const setRoles = (discordId, nom, main, secondary) => {
	const connection = mysql.createConnection({
		host: 'localhost',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWD,
		database: process.env.DB_NAME,
	})

	return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) {
				reject('Erreur de connexion à la base de données. CODE U14')
				return
			}

			connection.query(
				`UPDATE xf_user
				SET
					username=${mysql.escape(nom)},
					user_group_id=${mysql.escape(main)},
					secondary_group_ids=${mysql.escape(secondary.join(','))}
				WHERE
					discord_id=${mysql.escape(discordId)}`,
				(err, result) => {
					if (err) {
						console.error(err.toString())
						reject("Une erreur est survenue. CODE U29")
					}

					if (!result || result.affectedRows === 0) {
						reject("Une erreur est survenue. CODE U32")
					}

					resolve('Les permissions de base ont été correctement attribuées.')
			})
		})
	})
}

const last = () => {
	const connection = mysql.createConnection({
		host: 'localhost',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWD,
		database: process.env.DB_NAME,
	})

    return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) {
				reject("Erreur de connexion à la base de données. CODE U52")
                return
			}

			connection.query(
				`SELECT user_id, username FROM xf_user ORDER BY user_id DESC LIMIT 5`,
				(err, result) => {
                    if (err || !result || !result[0]) {
                        reject("Une erreur est survenue. CODE U60")
                        return
                    }

                    resolve(result)
				}
			)
		})
	})
}

const info = discordId => {
	const connection = mysql.createConnection({
		host: 'localhost',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWD,
		database: process.env.DB_NAME,
	})

    return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) {
				reject("Erreur de connexion à la base de données. CODE U83")
                return
			}

			connection.query(
				`SELECT
                    user_id,
                    discord_id,
                    username,
                    panel_pts,
                    panel_prs,
                    panel_abs,
					register_date * 1000 as register_date,
                    COUNT(id_medal) as medals_count
                FROM xf_user
                LEFT JOIN medal_attribut
                ON id_user = user_id
                WHERE discord_id = ${mysql.escape(discordId)}
                GROUP BY user_id`,
				(err, result) => {
                    if (err) {
                        reject("Une erreur est survenue. CODE U103")
                        return
                    }

                    if (!result || !result[0]) {
                        resolve(null)
                        return
                    }

                    resolve(result[0])
				}
			)
		})
	})
}

const getUsername = discordId => {
	const connection = mysql.createConnection({
		host: 'localhost',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWD,
		database: process.env.DB_NAME,
	})

	return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) {
				reject("Erreur de connexion à la base de données. CODE U130")
                return
			}

			connection.query(
				`SELECT i.platform_username FROM infos_recrutement AS i
                INNER JOIN xf_user as u
                ON u.user_id = i.user_id
                WHERE u.discord_id = ${mysql.escape(discordId)}`,
				(err, result) => {
                    if (err) {
                        reject("Une erreur est survenue. CODE U150")
                        return
                    }

                    if (!result || !result[0]) {
                        resolve(null)
                        return
                    }

                    resolve(result[0])
				}
			)
		})
	})
}

export default { last, info, setRoles, getUsername }