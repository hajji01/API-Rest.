import { generate, verify, isHashed } from "password-hash";
import * as mysql from "mysql2";
import { Request, Response } from "express";





export let connection = mysql.createConnection({
  host: "mysql-hodor.alwaysdata.net",
  user: "hodor",
  password: "Zakaria/2001",
  database: "hodor_01",
});

const express = require("express");
const app = express();
app.use(express.json());

connection.connect((err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données :', err);
    return;
  }

  console.log('Connexion à la base de données réussie !');


});

interface User {
  prenom: string;
  nom: string;
  mail: string;
  motdepasse: string;
  statut: string;
}

interface Salle {
  nom: string;
  numerosalle: number;
  statutsalle: boolean;
}

interface TokenResponse {
  token: string;
  dateconnexion: Date;
}
function generateTokenWithDate(length: number = 32): { token: string; dateconnexion: Date } {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let myToken = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charactersLength);
    myToken += characters.charAt(randomIndex);
  }

  const date = new Date();

  return {
    token: myToken,
    dateconnexion: date
  };
}


app.get('/generate-token', (req: any, res: any) => {
  const { token, dateconnexion } = generateTokenWithDate();

  res.json({ token, dateconnexion });
});

const port = process.env.PORT ?? 3000;
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});

app.post("/addusers", (req: Request, res: Response) => {
  const user: User = req.body;
  console.log(user.motdepasse);
  user.motdepasse = generate(user.motdepasse, { algorithm: 'sha256' });
  connection.query("INSERT INTO Users SET ?", user, (err, result) => {
    if (err) {
      console.log(err);
    }
    console.log(result);
  });
  res.sendStatus(200);
});

app.post("/addsalle", async (req: Request, res: Response) => {
  const token = req.headers["authorization"];
  const [utilisateur]: any = await connection.promise().query(`SELECT * FROM Users WHERE token='${token}'`, {});
  if (!token || new Date().getHours() - new Date(utilisateur[0]?.dateconnexion).getHours() > 1 || utilisateur[0].statut != 'A') {
    res.status(401).send("Vous êtes pas autorisé");
  }
  else {
    console.log(req.body);
    const salle: Salle = req.body;

    connection.query("INSERT INTO Salle SET ?", salle, (err, result) => {
      if (err) {
        console.log(err);
      }
      console.log(result);
      res.sendStatus(200);
    });
  }
});


app.post("/connexionuser", (req: Request, res: Response) => {
  const { mail, motdepasse } = req.body;
  connection.query(`SELECT * FROM Users WHERE mail='${mail}'`, {}, (err, result: any) => { //on cherche dans la bdd à travers le mail
    if (err) {
      console.log(err)
    }
    if (result && result.length == 0) { //SI le result existe on checke le longueur du result(nom,prenom,mail,mdp)
      res.sendStatus(404).send("L'utilisiteur n'existe pas")
    }
    else {

      if (req.body.motdepasse && verify(req.body.motdepasse, result[0]?.motdepasse)) {//je prends le mot de passe existe , je verifie si le mot de passe correspond au mdp hacher de la bdd)
        const value: any = generateTokenWithDate();
        console.log(value)
        connection.query(`UPDATE Users SET ? WHERE mail='${req.body.mail}'`, value, (err, result: any) => {
          if (err) {
            res.send(err)
          } else {

            res.send(value)
          }
        })
      }
      else {
        res.sendStatus(401)
      }

    }
  })
});

app.get('/getsalle', async (req: Request, res: Response) => {
  const token = req.headers["authorization"];

  const [utilisateur]: any[] = await connection.promise().query(`SELECT * FROM Users WHERE token='${token}'`, {});
  if (!token || (new Date().getHours() - new Date(utilisateur[0]?.dateconnexion).getHours()) > 1) {
    res.sendStatus(401);
  }

  if (utilisateur[0].statut === 'A') {
    connection.query("SELECT * FROM Salle", {}, (err, result: any) => {
      if (err) {
        res.send(err);
      } else {
        res.send(result);
      }
    });
  } else {
    connection.query(`SELECT * FROM Salle WHERE statutsalle = '${false}'`, {}, (err, result: any) => {
      if (err) {
        res.send(err);
      } else {
        res.send(result);
      }
    });
  }
});



app.put('/putsalle/:numerosalle', async (req: Request, res: Response) => {
  const token = req.headers["authorization"];

  const [utilisateur]: any[] = await connection.promise().query(`SELECT * FROM Users WHERE token='${token}'`, {});
  if (!token || (new Date().getHours() - new Date(utilisateur[0]?.dateconnexion).getHours()) > 1 || utilisateur[0].statut != 'A') {
    res.sendStatus(401);
  }

  const numerosalle: number = parseInt(req.params.numerosalle);
  const salle: Salle = req.body;

  connection.query(`UPDATE Salle SET ? WHERE numerosalle ='${numerosalle}'`, salle, (err, result) => {
    if (err) {
      res.send(err);
    } else {
      res.send(result);
    }
  });
});



app.delete('/deletesalle/:numerosalle', async (req: Request, res: Response) => {
  const token = req.headers["authorization"];

  const [utilisateur]: any[] = await connection
    .promise()
    .query(`SELECT * FROM Users WHERE token='${token}'`, {});

  if (!token || new Date().getHours() - new Date(utilisateur[0]?.dateconnexion).getHours() > 1 || utilisateur[0].statut != 'A') {
    res.sendStatus(401);
  }

  connection.query(`DELETE FROM Salle WHERE numerosalle ='${req.params.numerosalle}'`, (err, result) => {
    if (err) {
      res.send(err);
    } else {
      res.send(result);
    }
  });
});

app.delete('/deleteuser/:id', async (req: Request, res: Response) => {
  const token = req.headers["authorization"];

  const [utilisateur]: any[] = await connection
    .promise()
    .query(`SELECT * FROM Users WHERE token='${token}'`, {});

  if (!token || new Date().getHours() - new Date(utilisateur[0]?.dateconnexion).getHours() > 1 || utilisateur[0].statut !== 'A') {
    res.sendStatus(401);
  }

  connection.query(`DELETE FROM Users WHERE id='${req.params.id}'`, (err, result) => {
    if (err) {
      res.send(err);
    } else {
      res.send(result);
    }
  });
});


app.post("/logout", async (req: Request, res: Response) => {
  const token = req.headers["authorization"];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  connection.query(
    `UPDATE Users SET token = NULL WHERE token='${token}'`,
    (err, result) => {
      if (err) {
        console.error("Erreur lors de la suppression du token :", err);
        res.sendStatus(500);
      } else {
        res.sendStatus(200);
      }
    }
  );
});