const express = require('express');
const knex = require('knex')(require('./knexfile').development);
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Contact management service is up and running!');
});


app.post('/identify', async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Email or phoneNumber is required' });
  }

  // Step 1: Find all contacts that match email OR phoneNumber
  const contacts = await knex('contacts')
    .where(builder => {
      if (email) builder.orWhere('email', email);
      if (phoneNumber) builder.orWhere('phoneNumber', phoneNumber);
    })
    .orderBy('createdAt');

  // Step 2: If no contacts exist, create a new primary contact
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

  // Step 3: Determine the primary contact (oldest one)
  const primaryContact = contacts.find(c => c.linkPrecedence === 'primary') || contacts[0];

  // Step 4: Update other contacts to be secondary and link to primary
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

  // Step 5: Check if the current email/phone is already present
  const emailExists = email && contacts.some(c => c.email === email);
  const phoneExists = phoneNumber && contacts.some(c => c.phoneNumber === phoneNumber);

  // Step 6: If either email or phone is new, insert a new secondary contact
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

  // Step 7: Construct response
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
