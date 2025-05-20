const express = require('express');
const knex = require('knex')(require('./knexfile').development);
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Contact management service is up and running!');
});


app.post('/identify', async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Email or phoneNumber is required' });
    }

    const contacts = await knex('contacts')
      .where(builder => {
        if (email) builder.orWhere('email', email);
        if (phoneNumber) builder.orWhere('phoneNumber', phoneNumber);
      })
      .orderBy('createdAt');

    if (contacts.length === 0) {
      const [newContact] = await knex('contacts')
        .insert({ email, phoneNumber, linkPrecedence: 'primary' })
        .returning('*');
      return res.json({
        contact: {
          primaryContactId: newContact.id,
          emails: [newContact.email].filter(Boolean),
          phoneNumbers: [newContact.phoneNumber].filter(Boolean),
          secondaryContactIds: [],
        },
      });
    }

    const primaryContact = contacts.find(c => c.linkPrecedence === 'primary') || contacts[0];
    const secondaryContacts = contacts.filter(c => c.id !== primaryContact.id && c.linkPrecedence !== 'secondary');

    for (const contact of secondaryContacts) {
      await knex('contacts')
        .where({ id: contact.id })
        .update({
          linkPrecedence: 'secondary',
          linkedId: primaryContact.id,
          updatedAt: new Date(),
        });
    }

    const emailExists = email && contacts.some(c => c.email === email);
    const phoneExists = phoneNumber && contacts.some(c => c.phoneNumber === phoneNumber);

    if (!emailExists || !phoneExists) {
      const [newSecondary] = await knex('contacts')
        .insert({
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: 'secondary',
        })
        .returning('*');
      contacts.push(newSecondary);
    }

    const allContacts = await knex('contacts')
      .where('linkedId', primaryContact.id)
      .orWhere('id', primaryContact.id)
      .orderBy('createdAt');

    const emails = [...new Set(allContacts.map(c => c.email).filter(Boolean))];
    const phoneNumbers = [...new Set(allContacts.map(c => c.phoneNumber).filter(Boolean))];
    const secondaryContactIds = allContacts
      .filter(c => c.id !== primaryContact.id)
      .map(c => c.id);

    const responseData = {
      contact: {
        primaryContactId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    };

    console.log("Response: ", responseData);
    return res.json(responseData);
  } catch (err) {
    console.error('ERROR in /identify:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});


// Helper: walk the graph of linked contacts
async function getAllLinkedContacts(initialContacts) {
  const visited = new Set();
  const toVisit = [...initialContacts];

  while (toVisit.length > 0) {
    const current = toVisit.pop();
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const linked = await knex('contacts')
      .where('linkedId', current.id)
      .orWhere('id', current.linkedId || -1);

    for (const c of linked) {
      if (!visited.has(c.id)) toVisit.push(c);
    }
  }

  return knex('contacts')
    .whereIn('id', Array.from(visited))
    .orderBy('createdAt');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
