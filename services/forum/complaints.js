import mysql from "mysql"


const send = (discordId, message) => {
    const connection = mysql.createConnection({
        host: 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWD,
        database: process.env.DB_NAME
    })

    return new Promise((resolve, reject) => {
        connection.connect(err => {
            if (err) {
                reject("Connexion à la base de données impossible. CODE C15")
                return
            }

            connection.query(
                `INSERT INTO complaint (signature, content) VALUES (TO_BASE64(${mysql.escape(discordId)}), ${mysql.escape(message)});`,
                (err, result) => {
                    if (err) {
                        console.error(err)
                        reject("Une erreur est survenue. CODE C24")
                        return
                    }

                    if (result.affectedRows === 0) {
                        reject("Une erreur est survenue. CODE C29")
                        return
                    }

                    resolve()
                }
            )
        })
    })

}

export default { send }