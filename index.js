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

    const initialMatches = await knex('contacts')
      .where(builder => {
        if (email) builder.orWhere('email', email);
        if (phoneNumber) builder.orWhere('phoneNumber', phoneNumber);
      });

    let allContacts = [];
    let primaryContact;

    if (initialMatches.length > 0) {
      allContacts = await getAllLinkedContacts(initialMatches);
      primaryContact = allContacts.find(c => c.linkPrecedence === 'primary') || allContacts[0];

      // Update conflicting primary to secondary
      for (const contact of allContacts) {
        if (contact.id !== primaryContact.id && contact.linkPrecedence === 'primary') {
          await knex('contacts')
            .where({ id: contact.id })
            .update({
              linkPrecedence: 'secondary',
              linkedId: primaryContact.id,
              updatedAt: new Date(),
            });
        }
      }

      // Check if either value exists
const emailExists = email && allContacts.some(c => c.email === email);
const phoneExists = phoneNumber && allContacts.some(c => c.phoneNumber === phoneNumber);

const exactMatchExists = allContacts.some(c =>
  (c.email === (email || null)) && (c.phoneNumber === (phoneNumber || null))
);

// ✅ EARLY RETURN: one value is null, but the other exists => no insert
if (!exactMatchExists && (emailExists || phoneExists) && (!email || !phoneNumber)) {
  const finalContacts = allContacts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const emails = [...new Set(finalContacts.map(c => c.email).filter(Boolean))];
  const phoneNumbers = [...new Set(finalContacts.map(c => c.phoneNumber).filter(Boolean))];
  const secondaryContactIds = finalContacts
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

  return res.json(responseData);
}

// ✅ Otherwise, insert as secondary
if (!exactMatchExists) {
  await knex('contacts').insert({
    email: email || null,
    phoneNumber: phoneNumber || null,
    linkedId: primaryContact.id,
    linkPrecedence: 'secondary',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Re-fetch after insertion
  allContacts = await getAllLinkedContacts([primaryContact]);
  primaryContact = allContacts.find(c => c.linkPrecedence === 'primary') || allContacts[0];
}



    } else {
      // No matches: create primary contact
        const [{ id: newPrimaryId }] = await knex('contacts')
          .insert({
            email: email || null,
            phoneNumber: phoneNumber || null,
            linkedId: null,
            linkPrecedence: 'primary',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning('id');

        primaryContact = await knex('contacts').where('id', newPrimaryId).first();
        allContacts = [primaryContact];

    }

    const finalContacts = allContacts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const emails = [...new Set(finalContacts.map(c => c.email).filter(Boolean))];
    const phoneNumbers = [...new Set(finalContacts.map(c => c.phoneNumber).filter(Boolean))];
    const secondaryContactIds = finalContacts
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
    console.log("responseData", responseData);
    return res.json(responseData);

  } catch (err) {
    console.error('ERROR in /identify:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});



// Helper: walk the graph of linked contacts
async function getAllLinkedContacts(initialMatches) {
  const visited = new Set();
  const toVisit = [...initialMatches];

  while (toVisit.length > 0) {
    const current = toVisit.pop();

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const linked = await knex('contacts')
      .where(builder => {
        builder
          .where('linkedId', current.id)
          .orWhere('id', current.linkedId || -1)
          .orWhere('linkedId', current.linkedId || -1);
      });

    for (const c of linked) {
      if (!visited.has(c.id)) {
        toVisit.push(c);
      }
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
