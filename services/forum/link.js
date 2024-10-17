import mysql from "mysql2"


const link = (discordId, forumId) => {
    const connection = mysql.createConnection({
        host: 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWD,
        database: process.env.DB_NAME
    })

    return new Promise((resolve, reject) => {
        connection.connect(err => {
            if (err) {
                reject("Connexion à la base de données impossible. CODE L15")
                return
            }
            
            connection.query(
                `UPDATE xf_user
                SET discord_id = IF(discord_id IS NULL, ${mysql.escape(discordId)}, discord_id)
                WHERE user_id = ${mysql.escape(forumId)};`,
                (err, result) => {
                    if (err) {
                        reject("Une erreur est survenue. CODE L24")
                        return
                    }

                    if (result.changedRows === 0) {
                        reject("Une erreur est survenue. CODE L29")
                        return
                    }
    
                    resolve()
                }
            )
        })
    })

}

export default { link }