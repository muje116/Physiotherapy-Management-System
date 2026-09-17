/*
 * Seed script for PhysioCore
 * Run: pnpm --filter @physiocore/db seed
 *
 * Creates demo tenant with realistic physiotherapy practice data.
 */

import { PrismaClient, Role, AppointmentType, AppointmentStatus, InvoiceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SOUTH_AFRICAN_NAMES = [
  { first: 'Thabo', last: 'Mokoena' },
  { first: 'Lerato', last: 'Naidoo' },
  { first: 'Sipho', last: 'Botha' },
  { first: 'Nomsa', last: 'Pretorius' },
  { first: 'Bongani', last: 'Venter' },
  { first: 'Zanele', last: 'Du Plessis' },
  { first: 'Mandla', last: 'Fourie' },
  { first: 'Ayanda', last: 'Van Wyk' },
  { first: 'Themba', last: 'Snyman' },
  { first: 'Nomvula', last: 'Joubert' },
  { first: 'Sizwe', last: 'Kruger' },
  { first: 'Mbali', last: 'Viljoen' },
  { first: 'Lungile', last: 'Beukes' },
  { first: 'Nkosi', last: 'Grobler' },
  { first: 'Dineo', last: 'Malan' },
  { first: 'Tshepo', last: 'De Klerk' },
  { first: 'Refiloe', last: 'Smit' },
  { first: 'Katlego', last: 'Engelbrecht' },
  { first: 'Mpho', last: 'Steyn' },
  { first: 'Naledi', last: 'Coetzee' },
];

const MEDICAL_AIDS = [
  'Discovery Health',
  'Momentum Health',
  'Medihelp',
  'Bonitas',
  'Fedhealth',
  'GEMS',
];

const REFERRAL_SOURCES = [
  'GP Referral',
  'Specialist Referral',
  'Self-referral',
  'Insurance',
  'Word of Mouth',
  'Online Search',
];

async function main() {
  console.log('Seeding PhysioCore database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'physiocare-clinic' },
    update: {},
    create: {
      id: 'tenant-001',
      name: 'PhysioCare Clinic',
      slug: 'physiocare-clinic',
      practiceNumber: 'PRAC-2024-001',
      vatNumber: '4870213456',
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR',
    },
  });

  // Create tenant settings
  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      appointmentDuration: 45,
      workingHoursStart: '08:00',
      workingHoursEnd: '17:00',
      workingDays: [1, 2, 3, 4, 5],
      defaultReminderRules: true,
      portalEnabled: true,
      telehealthEnabled: true,
      smsProvider: 'TWILIO',
      emailProvider: 'RESEND',
      medicalAidSwitch: true,
      xeroIntegration: false,
    },
  });

  // Create users
  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@physiocare.com' } },
    update: {},
    create: {
      id: 'user-superadmin',
      tenantId: tenant.id,
      email: 'admin@physiocare.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'manager@physiocare.com' } },
    update: {},
    create: {
      id: 'user-admin',
      tenantId: tenant.id,
      email: 'manager@physiocare.com',
      passwordHash,
      firstName: 'Clinic',
      lastName: 'Manager',
      role: Role.ADMIN,
    },
  });

  const frontDeskUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'frontdesk@physiocare.com' } },
    update: {},
    create: {
      id: 'user-frontdesk',
      tenantId: tenant.id,
      email: 'frontdesk@physiocare.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Reception',
      role: Role.FRONT_DESK,
    },
  });

  const billingUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'billing@physiocare.com' } },
    update: {},
    create: {
      id: 'user-billing',
      tenantId: tenant.id,
      email: 'billing@physiocare.com',
      passwordHash,
      firstName: 'Finance',
      lastName: 'Officer',
      role: Role.BILLING,
    },
  });

  // Create therapist users and profiles
  const therapistData = [
    { id: 'user-therapist-1', email: 'sarah.johnson@physiocare.com', first: 'Sarah', last: 'Johnson', specialties: ['Orthopaedics', 'Sports'], regNo: 'HPCSA-PT-001' },
    { id: 'user-therapist-2', email: 'mike.thompson@physiocare.com', first: 'Mike', last: 'Thompson', specialties: ['Neurology', 'Paediatrics'], regNo: 'HPCSA-PT-002' },
    { id: 'user-therapist-3', email: 'lisa.patel@physiocare.com', first: 'Lisa', last: 'Patel', specialties: ['Cardiopulmonary', 'Geriatrics'], regNo: 'HPCSA-PT-003' },
    { id: 'user-therapist-4', email: 'james.wilson@physiocare.com', first: 'James', last: 'Wilson', specialties: ['Musculoskeletal', 'Post-surgical'], regNo: 'HPCSA-PT-004' },
  ];

  const therapists: { id: string; userId: string; tenantId: string }[] = [];

  for (const t of therapistData) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: t.email } },
      update: {},
      create: {
        id: t.id,
        tenantId: tenant.id,
        email: t.email,
        passwordHash,
        firstName: t.first,
        lastName: t.last,
        role: Role.THERAPIST,
      },
    });

    const therapist = await prisma.therapist.create({
      data: {
        id: `therapist-${t.id.split('-').pop()}`,
        tenantId: tenant.id,
        userId: user.id,
        registrationNo: t.regNo,
        specialties: t.specialties,
      },
    });

    therapists.push({ id: therapist.id, userId: user.id, tenantId: tenant.id });
  }

  // Create patients
  const patients: { id: string; tenantId: string }[] = [];

  for (let i = 0; i < 20; i++) {
    const name = SOUTH_AFRICAN_NAMES[i];
    const medicalAid = MEDICAL_AIDS[Math.floor(Math.random() * MEDICAL_AIDS.length)];
    const referral = REFERRAL_SOURCES[Math.floor(Math.random() * REFERRAL_SOURCES.length)];
    const gender = i % 2 === 0 ? 'Male' : 'Female';
    const birthYear = 1960 + Math.floor(Math.random() * 40);
    const birthMonth = 1 + Math.floor(Math.random() * 12);
    const birthDay = 1 + Math.floor(Math.random() * 28);

    const patient = await prisma.patient.create({
      data: {
        id: `patient-${String(i + 1).padStart(3, '0')}`,
        tenantId: tenant.id,
        patientCode: `P-${String(i + 1).padStart(5, '0')}`,
        firstName: name.first,
        lastName: name.last,
        dateOfBirth: new Date(birthYear, birthMonth - 1, birthDay),
        gender,
        phone: `+27${Math.floor(Math.random() * 900000000 + 100000000)}`,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@email.com`,
        address: {
          street: `${100 + i} Main Road`,
          city: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Port Elizabeth'][Math.floor(Math.random() * 5)],
          province: ['Western Cape', 'Gauteng', 'KwaZulu-Natal'][Math.floor(Math.random() * 3)],
          postalCode: `${2000 + i}`,
        },
        medicalAidName: medicalAid,
        medicalAidNo: `MA-${String(i + 1).padStart(6, '0')}`,
        referralSource: referral,
        referralDoctorName: `Dr. ${['Williams', 'Brown', 'Taylor', 'Davies', 'Evans'][Math.floor(Math.random() * 5)]}`,
      },
    });

    patients.push({ id: patient.id, tenantId: tenant.id });
  }

  // Assign each patient to 1-2 therapists
  for (const patient of patients) {
    const numTherapists = 1 + Math.floor(Math.random() * 2);
    const assignedTherapists = new Set<string>();

    for (let t = 0; t < numTherapists; t++) {
      const therapist = therapists[Math.floor(Math.random() * therapists.length)];
      if (!assignedTherapists.has(therapist.id)) {
        assignedTherapists.add(therapist.id);
        await prisma.patientTherapist.create({
          data: {
            patientId: patient.id,
            therapistId: therapist.id,
          },
        });
      }
    }
  }

  // Create appointments
  const appointmentTypes = Object.values(AppointmentType);
  const appointmentStatuses = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_SESSION, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW];

  const appointments: { id: string; tenantId: string; patientId: string; therapistId: string; status: string }[] = [];

  for (let i = 0; i < 100; i++) {
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const therapist = therapists[Math.floor(Math.random() * therapists.length)];
    const dayOffset = -60 + Math.floor(Math.random() * 75);
    const hourOffset = 8 + Math.floor(Math.random() * 8);
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + dayOffset);
    startAt.setHours(hourOffset, 0, 0, 0);
    const endAt = new Date(startAt.getTime() + 45 * 60 * 1000);

    let status: AppointmentStatus;
    if (dayOffset < 0) {
      status = Math.random() > 0.15 ? AppointmentStatus.COMPLETED : AppointmentStatus.CANCELLED;
    } else if (dayOffset < 3) {
      const statuses = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
      status = statuses[Math.floor(Math.random() * statuses.length)];
    } else {
      status = AppointmentStatus.SCHEDULED;
    }

    const appt = await prisma.appointment.create({
      data: {
        id: `appt-${String(i + 1).padStart(3, '0')}`,
        tenantId: tenant.id,
        patientId: patient.id,
        therapistId: therapist.id,
        startAt,
        endAt,
        type: appointmentTypes[Math.floor(Math.random() * appointmentTypes.length)],
        status,
        isTelehealth: Math.random() > 0.9,
      },
    });

    appointments.push({ id: appt.id, tenantId: tenant.id, patientId: patient.id, therapistId: therapist.id, status: appt.status });
  }

  // Create SOAP notes for 30 completed appointments
  const completedAppts = appointments.filter(a => a.status === AppointmentStatus.COMPLETED).slice(0, 30);

  const soapSubjective = [
    'Patient reports persistent lower back pain rated 6/10, aggravated by prolonged sitting and lifting. Pain radiates down right leg to the knee.',
    'Patient complains of stiffness in the neck and right shoulder after sleeping awkwardly. Pain level 4/10 with limited range of motion.',
    'Reports significant improvement since last session. Left knee pain reduced from 7/10 to 3/10. Able to climb stairs with less discomfort.',
    'Patient presents with acute onset of right ankle pain after twisting during a morning run. Unable to bear weight fully. Pain rated 8/10.',
    'Complains of bilateral shoulder pain aggravated by overhead activities. Difficulty reaching for items on high shelves. Pain level 5/10.',
    'Reports tingling and numbness in the left hand, particularly in the thumb and index finger. Symptoms worse at night. Pain rated 6/10.',
    'Patient states hip pain has improved with the exercises. Still experiences some discomfort after long walks. Pain currently 3/10.',
    'Worsening of lower back pain over the past week. Patient attributes this to increased workload and prolonged standing. Pain rated 7/10.',
    'Reports good progress with shoulder rehabilitation. External rotation strength improving. Occasional pain with heavy lifting. Pain 2/10.',
    'Patient complains of tightness in the hamstrings and difficulty straightening the right leg fully. Pain behind the knee rated 4/10.',
    'Reports recent fall onto outstretched hand. Wrist pain and swelling present. Difficulty gripping objects. Pain rated 6/10.',
    'Patient reports morning stiffness in both knees lasting approximately 30 minutes. Pain improves with movement but returns after rest. Pain 5/10.',
    'Complaints of recurring tension headaches originating from the neck and upper trapezius. Frequency: 3-4 per week. Pain rated 5/10.',
    'Reports significant reduction in sciatic symptoms. Sitting tolerance has improved from 15 minutes to 45 minutes. Residual pain 3/10.',
    'Patient presents with plantar fasciitis symptoms. Sharp heel pain upon first steps in the morning, easing after a few minutes. Pain 6/10.',
    'Reports shoulder pain when throwing or serving in tennis. Internal rotation limited. Clicking sensation with movement. Pain 4/10.',
    'Patient reports dizziness and vertigo when turning head quickly. Cervical spine stiffness noted. Pain in upper neck rated 4/10.',
    'Improvement in post-surgical knee range of motion. Flexion increased from 60 to 90 degrees. Still lacks full extension. Pain 4/10.',
    'Reports elbow pain aggravated by gripping and typing. Lateral epicondyle tender to palpation. Pain rated 5/10.',
    'Patient reports lower back pain that is worse in the morning and improves during the day. Stiffness limits forward bending. Pain 5/10.',
    'Reports good compliance with home exercise program. Wrist extension strength improving gradually. Pain at rest now 1/10.',
    'Patient complains of clicking and locking sensation in the right knee. Occasional giving way when walking downstairs. Pain rated 5/10.',
    'Reports hip bursitis symptoms improved with activity modification. Still painful when lying on the affected side. Pain 4/10.',
    'Patient describes sharp, shooting pain down the right arm when looking up. Cervical spine restrictions noted. Pain 6/10.',
    'Reports ankle instability after recurrent sprains. Feels insecure walking on uneven surfaces. Mild swelling present. Pain 3/10.',
    'Patient reports frozen shoulder symptoms - severely limited range of motion in all planes. Pain at night disturbing sleep. Pain 7/10.',
    'Reports gradual onset of knee pain over several months. Pain worse after prolonged sitting and descending stairs. Pain 5/10.',
    'Patient states lower back pain is now manageable. Able to return to light duties at work. Pain has reduced to 2/10 from initial 8/10.',
    'Reports difficulty with fine motor tasks due to thumb base pain. Grind test positive. Pain rated 4/10.',
    'Patient reports significant postural improvement. Reduced shoulder rounding. Occasional discomfort between shoulder blades. Pain 2/10.',
  ];

  const soapObjective = [
    'Lumbar spine ROM: flexion 60 degrees, extension 20 degrees. SLR positive at 45 degrees right. Muscle spasm noted in bilateral paraspinals.',
    'Cervical spine: rotation limited to 60 degrees right, 50 degrees left. Lateral flexion restricted. Trigger points in right upper trapezius.',
    'Left knee: flexion 120 degrees, extension 0 degrees. Joint line tenderness negative. Quadriceps strength 4/5. McMurrays negative.',
    'Right ankle: moderate swelling noted. Dorsiflexion limited to 5 degrees, plantarflexion 30 degrees. Anterior drawer test positive.',
    'Shoulder elevation: 140 degrees active, 160 degrees passive. External rotation 60 degrees. Empty can test positive right shoulder.',
    'Cervical spine: compression test positive right. Spurling test reproduces symptoms. Upper limb tension test positive for median nerve.',
    'Hip: flexion 100 degrees, abduction 30 degrees. FABER test positive. Trendelenburg sign negative. Strength: 4/5 hip flexors.',
    'Lumbar spine: extension restricted and reproduces pain. Quadrant loading positive right. Neural tension testing positive for sciatic nerve.',
    'Shoulder: full active ROM achieved. Rotator cuff strength 4+/5. Apprehension test negative. Hawkins-Kennedy negative.',
    'Right knee: flexion 100 degrees, extension -5 degrees. Posterior sag sign absent. Hamstring flexibility: 60 degrees SLR.',
    'Wrist: swelling and ecchymosis noted dorsally. Flexion 40 degrees, extension 30 degrees. Grip strength 60% of unaffected side.',
    'Knees: bilateral crepitus with flexion. Patellar grind test positive right. Quadriceps angle 18 degrees. Strength 4/5 bilaterally.',
    'Cervical-thoracic junction: reduced mobility T1-4. Rounded shoulder posture. Forward head posture noted. Upper trapezius hypertonicity.',
    'Lumbar spine: flexion 80 degrees, extension 15 degrees. Neural tension resolved. SLR 70 degrees bilaterally. Strength 4+/5.',
    'Foot: calcaneal valgus noted. Tarsal tunnel negative. Windlass test positive. Plantar fascia tender along medial band. Silfverskiold test positive.',
    'Glenohumeral joint: internal rotation limited to T12 level. Posterior capsule tightness. Scapular dyskinesis noted.',
    'Cervical spine: reduced range of motion in rotation and lateral flexion. Vertebral artery test negative. Positional testing negative.',
    'Knee: incision well-healed. Flexion 90 degrees, extension -5 degrees. Patellar mobility restricted superiorly. Quadriceps lag 10 degrees.',
    'Elbow: full extension 0 degrees, flexion 130 degrees. Resisted wrist extension reproduces pain. Cozens test positive.',
    'Lumbar spine: flexion limited to 40 degrees due to pain. Extension 10 degrees. Modified Schober 12cm. Dural tension signs positive.',
    'Wrist: full pain-free range of motion achieved. Grip strength 90% of unaffected side. Thumb opposition normal.',
    'Knee: positive McMurray test medial meniscus. Joint line tenderness. Effusion ++. Patellar apprehension negative. Laxity testing stable.',
    'Hip: flexion 90 degrees, internal rotation 15 degrees, external rotation 30 degrees. Pain on resisted abduction. Ober test negative.',
    'Cervical: reduced lordosis on observation. Rotation 70 degrees bilaterally. Distraction test relieves symptoms. Shoulder depression positive.',
    'Ankle: mild swelling anterior talofibular ligament. Inversion stress test positive. Anterior drawer 5mm compared to contralateral.',
    'Shoulder: passive ROM severely restricted - elevation 80 degrees, external rotation 20 degrees, internal rotation to buttock.',
    'Knee: flexion 100 degrees, extension 0 degrees. Patellofemoral compression test positive. Clarke sign positive. VMO atrophy noted.',
    'Lumbar: full pain-free ROM achieved. Neurological examination intact. Strength 5/5. Functional reach improved.',
    'Thumb: CMC joint subluxation with stress. Grind test positive. Pinch strength reduced to 50% compared to left. Kapandji score 7/10.',
    'Posture: improved thoracic extension. Chin-in position maintained. Scapular retraction strength 4/5. Manual muscle testing improved.',
  ];

  const soapAssessment = [
    'Patient presents with mechanical low back pain with right-sided sciatica. Responding well to manual therapy. Improvement expected within 2-4 weeks.',
    'Acute cervical facet joint dysfunction with associated muscle spasm. Good prognosis with continued mobilisation and postural exercises.',
    'Patellofemoral pain syndrome with good response to conservative treatment. Continue with quadriceps strengthening and patellar taping.',
    'Grade II lateral ankle sprain with anterior talofibular ligament involvement. Stable for progressive weight-bearing rehabilitation.',
    'Rotator cuff tendinopathy with subacromial impingement. Likely secondary to repetitive overhead activities. Responding to eccentric exercises.',
    'Cervical radiculopathy affecting C6 nerve root. Neural mobilisation techniques indicated. Monitor for signs of progression.',
    'Hip osteoarthritis - moderate severity. Conservative management appropriate at this stage. Consider orthopaedic review if symptoms progress.',
    'Chronic low back pain with centralisation phenomenon. Mechanical diagnosis and therapy approach shows positive directional preference.',
    'Adhesive capsulitis resolving phase. Continue with capsular stretches and strengthening programme. Recovery expected 6-12 months.',
    'Post-operative ACL reconstruction rehabilitation progressing well. Phase 2 criteria met. Advance to phase 3 strengthening programme.',
    'Distal radius fracture healing well. Post-immobilisation stiffness responding to therapy. Continue with progressive strengthening.',
    'Bilateral knee osteoarthritis - moderate. Activity modification and quadriceps strengthening key. Consider bracing for symptomatic relief.',
    'Cervicogenic tension-type headaches. Contributing factors include posture and stress. Good response to mobilisation and ergonomic advice.',
    'Lumbar disc herniation with radiculopathy - improving with conservative care. Continue neural mobilisation and core stability work.',
    'Chronic plantar fasciitis with biomechanical contributing factors. Orthotics recommended. Responding to stretching and shockwave therapy.',
    'Shoulder impingement with secondary scapular dyskinesis. Continue with rotator cuff and scapular stabilisation programme.',
    'Cervical vertigo likely of mechanical origin. Responding to manual therapy and vestibular rehabilitation. Proprioceptive exercises indicated.',
    'Post-total knee replacement rehabilitation on track. ROM improving steadily. Focus on quadriceps strengthening and gait re-education.',
    'Lateral epicondylitis (tennis elbow) - chronic. Responding to eccentric wrist extensor programme. Consider corticosteroid if plateau.',
    'Mechanical low back pain with favourable prognosis. Maintain current management. Progress to functional rehabilitation for return to work.',
    'Wrist tendinopathy resolved. Clear for return to normal activities. Maintain strengthening programme for prevention of recurrence.',
    'Medial meniscus tear - likely degenerative. Conservative management appropriate. Consider surgical referral if mechanical symptoms persist.',
    'Greater trochanteric pain syndrome with associated gluteal tendinopathy. Responding well to load management and eccentric hip programme.',
    'Cervical facet syndrome with associated headaches. Responding to mobilisation. Continue with postural correction and ergonomic setup.',
    'Chronic ankle instability. Proprioceptive deficit identified. Continue with balance and neuromuscular control training.',
    'Frozen shoulder (adhesive capsulitis) in freezing phase. Intensive physiotherapy indicated. May require MUA if no progress in 3 months.',
    'Patellofemoral pain syndrome with biomechanical contributing factors. Foot orthotics under consideration. Progressing with VMO retraining.',
    'Mechanical low back pain - resolved. Discharge planning initiated. Home exercise programme for maintenance. Return to full activity.',
    'CMC joint osteoarthritis of thumb. Splinting recommended for symptom management. Continue with activity modification and strengthening.',
    'Postural dysfunction with associated upper cross syndrome. Good improvement with correction exercises. Maintain maintenance programme.',
  ];

  const soapPlan = [
    'Continue lumbar mobilisation grades III-IV. Progress core stability exercises. Ergonomic advice for sitting posture. Review in 1 week.',
    'Continue cervical mobilisation and soft tissue release. Commence deep neck flexor strengthening. Postural taping. Review in 5 days.',
    'Progress quadriceps strengthening to closed chain. Add step-up exercises. Patellar taping as needed. Goal: pain-free stair climbing.',
    'Progress to full weight-bearing in boot. Begin proprioceptive exercises. Wobble board training. Review in 1 week for progression.',
    'Continue eccentric loading programme. Progress to plyometric exercises next session. Scapular stabilisation programme ongoing.',
    'Continue neural mobilisation. Add cervical stabilisation. Consider ergonomic workstation assessment. Review in 3 days for reassessment.',
    'Continue hip strengthening programme. Add pool-based exercises for low-impact conditioning. Consider orthopaedic consult. Review 2 weeks.',
    'Maintain directional preference extension exercises. Progress to dynamic lumbar stabilisation. Return to work planning. Review 1 week.',
    'Continue capsular stretches 3x daily. Progress to wall slides and pulley exercises. Low-grade mobilisations. Review weekly.',
    'Progress to phase 3: jogging programme, agility drills, sport-specific training. Continue quadriceps and hamstring strengthening.',
    'Increase wrist strengthening with putty and weights. Progress grip strengthening. Return to sport in 2-3 weeks with protective bracing.',
    'Continue quadriceps strengthening. Add stationary bike for ROM. Consider weight loss advice. Orthopaedic review if plateau at 6 weeks.',
    'Continue postural correction exercises. Add cervical proprioceptive retraining. Ergonomic assessment at workplace. Review 2 weeks.',
    'Progress extension exercises to standing. Add dynamic lumbar stabilisation. Neural mobilisation as tolerated. Review in 1 week.',
    'Continue plantar fascia stretching and calf stretches. Add intrinsic foot muscle strengthening. Review orthotic fit. Shockwave therapy series.',
    'Progress rotator cuff strengthening. Add sport-specific training. Continue scapular control. Return to tennis progression protocol.',
    'Continue manual therapy to upper cervical spine. Add vestibular habituation exercises. Balance training. Review response in 1 week.',
    'Continue knee flexion and extension ROM exercises. Add stationary cycling. Progress to independent stairs. Gait re-education daily.',
    'Continue eccentric wrist extensor programme. Add concentric loading. Consider counterforce bracing for activity. Review 1 week.',
    'Progress to functional rehabilitation programme. Return to work plan with graduated hours. Maintenance exercises for prevention.',
    'Discharge from active physiotherapy. Home exercise programme provided. Return if symptoms recur. Follow-up in 4 weeks.',
    'Continue conservative management. Activity modification advice given. Review in 2 weeks. Surgical consult if locking persists.',
    'Progress gluteal strengthening. Add lateral hip loading. Continue load management. Review response to injection if considered.',
    'Continue mobilisation and postural correction. Add ergonomic workstation adjustments. Stress management strategies discussed.',
    'Progress balance training to unstable surfaces. Add sport-specific agility drills. Continue proprioceptive exercises. Review 2 weeks.',
    'Continue capsular stretching and mobilisation. Consider hydrotherapy for pain-free ROM. Review monthly for progression assessment.',
    'Progress VMO strengthening with biofeedback. Add lateral step-downs. Consider foot orthotics. Review in 2 weeks.',
    'Discharge from physiotherapy. Home maintenance programme provided. Return to full activities. Follow-up PRN.',
    'Continue with thumb CMC joint protection techniques. Progress thenar strengthening. Review splint fit. Follow up 4 weeks.',
    'Progress to maintenance programme. Encourage continued postural awareness. Gym programme for general conditioning. Review in 1 month.',
  ];

  for (let i = 0; i < completedAppts.length; i++) {
    const appt = completedAppts[i];
    const therapist = therapists[Math.floor(Math.random() * therapists.length)];

    await prisma.soapNote.create({
      data: {
        id: `soap-${String(i + 1).padStart(3, '0')}`,
        tenantId: tenant.id,
        appointmentId: appt.id,
        patientId: appt.patientId,
        therapistId: appt.therapistId,
        subjective: soapSubjective[i],
        objective: soapObjective[i],
        assessment: soapAssessment[i],
        plan: soapPlan[i],
        icd10Codes: [['M54.5'], ['M79.6']][Math.floor(Math.random() * 2)],
        cptCodes: [['97110'], ['97140'], ['97112']][Math.floor(Math.random() * 3)],
        painScore: 2 + Math.floor(Math.random() * 6),
        signedAt: new Date(),
        signedByUserId: therapist.userId,
      },
    });
  }

  // Create invoices
  const usedInvoiceAppointmentIds = new Set<string>();

  for (let i = 0; i < 40; i++) {
    const patient = patients[Math.floor(Math.random() * patients.length)];

    // Ensure unique appointmentId (appointmentId is @unique in schema)
    let appointmentId: string | undefined;
    if (i < completedAppts.length) {
      appointmentId = completedAppts[i].id;
    } else {
      const unused = completedAppts.find(a => !usedInvoiceAppointmentIds.has(a.id));
      if (unused) {
        appointmentId = unused.id;
      }
    }

    if (appointmentId) {
      usedInvoiceAppointmentIds.add(appointmentId);
    }

    const amount = 350 + Math.floor(Math.random() * 650);
    const subtotal = Math.round(amount * 100) / 100;
    const vatAmount = Math.round(subtotal * 0.15 * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const dueDate = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    let status: InvoiceStatus;
    let paidAt: Date | null = null;
    let paymentMethod: string | null = null;

    if (i < 30) {
      status = InvoiceStatus.PAID;
      paidAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 14 + 1) * 24 * 60 * 60 * 1000);
      paymentMethod = ['CARD', 'EFT', 'CASH', 'MEDICAL_AID'][Math.floor(Math.random() * 4)];
    } else if (i < 35) {
      status = InvoiceStatus.UNPAID;
    } else if (i < 38) {
      status = InvoiceStatus.OVERDUE;
    } else if (i < 39) {
      status = InvoiceStatus.SUBMITTED_TO_MEDICAL_AID;
    } else {
      status = InvoiceStatus.SUBMITTED_TO_MEDICAL_AID;
    }

    await prisma.invoice.create({
      data: {
        id: `inv-${String(i + 1).padStart(3, '0')}`,
        tenantId: tenant.id,
        invoiceNumber: `INV-${String(i + 1).padStart(5, '0')}`,
        patientId: patient.id,
        appointmentId,
        lineItems: [
          {
            description: 'Physiotherapy Consultation',
            quantity: 1,
            unitPrice: subtotal,
            total: subtotal,
          },
        ],
        subtotal,
        vatAmount,
        total,
        status,
        paymentMethod,
        paidAt,
        dueDate,
        createdAt,
      },
    });
  }

  // Create exercise plans with items
  const exercisePlans = [
    { name: 'Lower Back Rehabilitation', exercises: [
      { name: 'Pelvic Tilts', bodyRegion: 'Lumbar', sets: 3, reps: 10, frequency: 'Daily', notes: 'Slow and controlled', order: 1 },
      { name: 'Cat-Camel Stretch', bodyRegion: 'Thoracic', sets: 2, reps: 10, frequency: 'Daily', notes: 'Full range', order: 2 },
      { name: 'Bird Dog', bodyRegion: 'Core', sets: 3, reps: 8, frequency: 'Daily', notes: 'Keep back flat', order: 3 },
      { name: 'Clamshells', bodyRegion: 'Hip', sets: 3, reps: 12, frequency: 'Daily', notes: 'Use resistance band', order: 4 },
    ]},
    { name: 'Shoulder Rehab Programme', exercises: [
      { name: 'Pendulum Swings', bodyRegion: 'Shoulder', sets: 2, reps: 15, frequency: '3x daily', notes: 'Gentle circles', order: 1 },
      { name: 'Wall Slides', bodyRegion: 'Shoulder', sets: 3, reps: 10, frequency: 'Daily', notes: 'Keep elbows on wall', order: 2 },
      { name: 'External Rotation', bodyRegion: 'Shoulder', sets: 3, reps: 12, frequency: 'Every other day', notes: 'Use light band', order: 3 },
      { name: 'Scapular Retraction', bodyRegion: 'Thoracic', sets: 3, reps: 15, frequency: 'Daily', notes: 'Squeeze shoulder blades', order: 4 },
    ]},
    { name: 'Post-Surgical Knee Rehab', exercises: [
      { name: 'Quad Sets', bodyRegion: 'Knee', sets: 3, reps: 15, frequency: 'Hourly', notes: 'Tighten quad, hold 5s', order: 1 },
      { name: 'Ankle Pumps', bodyRegion: 'Ankle', sets: 2, reps: 20, frequency: 'Hourly', notes: 'Prevent DVT', order: 2 },
      { name: 'Straight Leg Raise', bodyRegion: 'Knee', sets: 3, reps: 10, frequency: '3x daily', notes: 'Keep knee locked', order: 3 },
      { name: 'Heel Slides', bodyRegion: 'Knee', sets: 3, reps: 10, frequency: '3x daily', notes: 'Pain-free range', order: 4 },
    ]},
    { name: 'Cervical Spine Programme', exercises: [
      { name: 'Chin Tucks', bodyRegion: 'Cervical', sets: 3, reps: 10, frequency: 'Daily', notes: 'Hold 5 seconds', order: 1 },
      { name: 'Neck Rotations', bodyRegion: 'Cervical', sets: 2, reps: 10, frequency: 'Daily', notes: 'Pain-free range', order: 2 },
      { name: 'Scalene Stretch', bodyRegion: 'Cervical', sets: 2, reps: 30, frequency: 'Daily', notes: 'Hold 30s each side', order: 3 },
      { name: 'Upper Trap Stretch', bodyRegion: 'Shoulder', sets: 2, reps: 30, frequency: 'Daily', notes: 'Hold 30s each side', order: 4 },
    ]},
    { name: 'Ankle Strengthening', exercises: [
      { name: 'Alphabet Circles', bodyRegion: 'Ankle', sets: 2, reps: 1, frequency: '2x daily', notes: 'Trace alphabet with foot', order: 1 },
      { name: 'Banded Dorsiflexion', bodyRegion: 'Ankle', sets: 3, reps: 12, frequency: 'Daily', notes: 'Use resistance band', order: 2 },
      { name: 'Single Leg Balance', bodyRegion: 'Ankle', sets: 3, reps: 30, frequency: 'Daily', notes: 'Progress to eyes closed', order: 3 },
      { name: 'Calf Raises', bodyRegion: 'Ankle', sets: 3, reps: 15, frequency: 'Daily', notes: 'Full range', order: 4 },
    ]},
    { name: 'Hip Strengthening Programme', exercises: [
      { name: 'Bridging', bodyRegion: 'Hip', sets: 3, reps: 12, frequency: 'Daily', notes: 'Glute squeeze at top', order: 1 },
      { name: 'Side-lying Hip Abduction', bodyRegion: 'Hip', sets: 3, reps: 12, frequency: 'Daily', notes: 'Keep pelvis stable', order: 2 },
      { name: 'Standing Hip Extension', bodyRegion: 'Hip', sets: 3, reps: 10, frequency: 'Daily', notes: 'Hold 3s at top', order: 3 },
      { name: 'Lunges', bodyRegion: 'Hip', sets: 2, reps: 10, frequency: 'Every other day', notes: 'Front knee over ankle', order: 4 },
    ]},
    { name: 'Posture Correction', exercises: [
      { name: 'Wall Angels', bodyRegion: 'Thoracic', sets: 3, reps: 10, frequency: 'Daily', notes: 'Keep back flat on wall', order: 1 },
      { name: 'Prone Extension', bodyRegion: 'Thoracic', sets: 2, reps: 10, frequency: 'Daily', notes: 'Lift chest off floor', order: 2 },
      { name: 'Band Pull-Aparts', bodyRegion: 'Shoulder', sets: 3, reps: 12, frequency: 'Daily', notes: 'Squeeze shoulder blades', order: 3 },
      { name: 'Doorway Chest Stretch', bodyRegion: 'Chest', sets: 2, reps: 30, frequency: '2x daily', notes: 'Hold 30s each side', order: 4 },
    ]},
    { name: 'Core Stability Programme', exercises: [
      { name: 'Dead Bug', bodyRegion: 'Core', sets: 3, reps: 8, frequency: 'Daily', notes: 'Slow and controlled', order: 1 },
      { name: 'Plank', bodyRegion: 'Core', sets: 3, reps: 30, frequency: 'Daily', notes: '30s holds, progress to 60s', order: 2 },
      { name: 'Side Plank', bodyRegion: 'Core', sets: 2, reps: 20, frequency: 'Daily', notes: '20s each side', order: 3 },
      { name: 'Supine Marching', bodyRegion: 'Core', sets: 3, reps: 10, frequency: 'Daily', notes: 'Keep back flat', order: 4 },
    ]},
    { name: 'Rotator Cuff Rehab', exercises: [
      { name: 'Prone I-Y-T Raises', bodyRegion: 'Shoulder', sets: 3, reps: 8, frequency: 'Every other day', notes: 'Light weights', order: 1 },
      { name: 'Side-lying ER', bodyRegion: 'Shoulder', sets: 3, reps: 12, frequency: 'Every other day', notes: 'Light dumbbell', order: 2 },
      { name: 'Prone Horizontal Abduction', bodyRegion: 'Shoulder', sets: 3, reps: 10, frequency: 'Every other day', notes: 'Thumbs up', order: 3 },
      { name: 'Standing ER with Band', bodyRegion: 'Shoulder', sets: 3, reps: 12, frequency: 'Daily', notes: 'Elbow at 90', order: 4 },
    ]},
    { name: 'Balance and Proprioception', exercises: [
      { name: 'Single Leg Stance', bodyRegion: 'Ankle', sets: 3, reps: 30, frequency: 'Daily', notes: 'Progress surface difficulty', order: 1 },
      { name: 'Tandem Walking', bodyRegion: 'Lower Limb', sets: 3, reps: 10, frequency: 'Daily', notes: 'Heel to toe', order: 2 },
      { name: 'Star Excursion Balance', bodyRegion: 'Ankle', sets: 3, reps: 8, frequency: '3x weekly', notes: 'Reach in all directions', order: 3 },
      { name: 'BOSU Ball Squats', bodyRegion: 'Lower Limb', sets: 3, reps: 10, frequency: '3x weekly', notes: 'Use support if needed', order: 4 },
    ]},
    { name: 'Elbow Rehabilitation', exercises: [
      { name: 'Wrist Flexor Stretch', bodyRegion: 'Forearm', sets: 2, reps: 30, frequency: 'Daily', notes: 'Hold 30s', order: 1 },
      { name: 'Wrist Extensor Stretch', bodyRegion: 'Forearm', sets: 2, reps: 30, frequency: 'Daily', notes: 'Hold 30s', order: 2 },
      { name: 'Eccentric Wrist Extension', bodyRegion: 'Forearm', sets: 3, reps: 15, frequency: 'Daily', notes: 'Slow lowering phase', order: 3 },
      { name: 'Grip Strengthening', bodyRegion: 'Hand', sets: 3, reps: 15, frequency: 'Daily', notes: 'Use putty or gripper', order: 4 },
    ]},
    { name: 'Plantar Fasciitis Management', exercises: [
      { name: 'Towel Curls', bodyRegion: 'Foot', sets: 3, reps: 15, frequency: '2x daily', notes: 'Grab towel with toes', order: 1 },
      { name: 'Plantar Fascia Stretch', bodyRegion: 'Foot', sets: 3, reps: 30, frequency: 'Every morning', notes: 'Stretch before stepping out of bed', order: 2 },
      { name: 'Calf Stretch', bodyRegion: 'Calf', sets: 3, reps: 30, frequency: '3x daily', notes: 'Hold 30s each side', order: 3 },
      { name: 'Gastrocnemius Eccentric', bodyRegion: 'Calf', sets: 3, reps: 12, frequency: 'Daily', notes: 'Lower phase 3 seconds', order: 4 },
    ]},
    { name: 'TMJ Rehabilitation', exercises: [
      { name: 'Jaw Opening Stretch', bodyRegion: 'TMJ', sets: 2, reps: 10, frequency: 'Daily', notes: 'Pain-free range', order: 1 },
      { name: 'Isometric Jaw Exercises', bodyRegion: 'TMJ', sets: 3, reps: 5, frequency: 'Daily', notes: 'Hold 5 seconds', order: 2 },
      { name: 'Tongue Posture', bodyRegion: 'TMJ', sets: 10, reps: 10, frequency: 'Hourly', notes: 'Tongue on palate', order: 3 },
      { name: 'Neck Relaxation', bodyRegion: 'Cervical', sets: 2, reps: 10, frequency: 'Daily', notes: 'Gentle neck rolls', order: 4 },
    ]},
    { name: 'Post-Mastectomy Rehab', exercises: [
      { name: 'Deep Breathing', bodyRegion: 'Chest', sets: 3, reps: 10, frequency: '2x daily', notes: 'Focus on full expansion', order: 1 },
      { name: 'Shoulder Pendulums', bodyRegion: 'Shoulder', sets: 2, reps: 15, frequency: '2x daily', notes: 'Pain-free range', order: 2 },
      { name: 'Wall Climbing', bodyRegion: 'Shoulder', sets: 3, reps: 10, frequency: 'Daily', notes: 'Walk fingers up wall', order: 3 },
      { name: 'Scapular ROM', bodyRegion: 'Thoracic', sets: 3, reps: 10, frequency: 'Daily', notes: 'Full pain-free range', order: 4 },
    ]},
    { name: 'Hand Therapy Programme', exercises: [
      { name: 'Tendon Glides', bodyRegion: 'Hand', sets: 3, reps: 10, frequency: '3x daily', notes: 'Full fist to full extension', order: 1 },
      { name: 'Putty Pinch', bodyRegion: 'Hand', sets: 3, reps: 10, frequency: 'Daily', notes: 'Tip pinch and lateral pinch', order: 2 },
      { name: 'Thumb Opposition', bodyRegion: 'Thumb', sets: 3, reps: 12, frequency: 'Daily', notes: 'Touch each fingertip', order: 3 },
      { name: 'Finger Spread with Band', bodyRegion: 'Hand', sets: 3, reps: 10, frequency: 'Daily', notes: 'Use small rubber band', order: 4 },
    ]},
  ];

  for (let i = 0; i < exercisePlans.length; i++) {
    const plan = exercisePlans[i];
    const patient = patients[Math.floor(Math.random() * patients.length)];

    const createdPlan = await prisma.exercisePlan.create({
      data: {
        id: `plan-${String(i + 1).padStart(3, '0')}`,
        tenantId: tenant.id,
        patientId: patient.id,
        name: plan.name,
        isActive: Math.random() > 0.2,
      },
    });

    for (const ex of plan.exercises) {
      await prisma.exercisePlanItem.create({
        data: {
          planId: createdPlan.id,
          exerciseName: ex.name,
          bodyRegion: ex.bodyRegion,
          sets: ex.sets,
          reps: ex.reps,
          durationSecs: null,
          frequency: ex.frequency,
          notes: ex.notes,
          order: ex.order,
        },
      });
    }
  }

  // Create outcome measures
  const outcomeMeasureTypes = ['OSWESTRY', 'NRS', 'DASH'];
  for (let i = 0; i < 10; i++) {
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const type = outcomeMeasureTypes[Math.floor(Math.random() * outcomeMeasureTypes.length)];

    let maxScore: number;
    switch (type) {
      case 'OSWESTRY':
        maxScore = 50;
        break;
      case 'NRS':
        maxScore = 10;
        break;
      case 'DASH':
        maxScore = 100;
        break;
      default:
        maxScore = 10;
    }

    const score = Math.round(maxScore * 0.2 + Math.random() * maxScore * 0.5);
    const daysAgo = Math.floor(Math.random() * 60);

    await prisma.outcomeMeasure.create({
      data: {
        id: `om-${String(i + 1).padStart(3, '0')}`,
        tenantId: tenant.id,
        patientId: patient.id,
        type,
        score,
        maxScore,
        percentage: Math.round((score / maxScore) * 100),
        notes: `Initial ${type} assessment completed. Patient reported ${type === 'NRS' ? 'pain level' : 'functional limitation'} consistent with clinical presentation.`,
        recordedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Create marketing campaigns
  const campaigns = [
    {
      id: 'camp-001',
      name: 'Winter Wellness Promotion',
      channel: ['EMAIL', 'SMS'],
      template: 'Beat the winter blues with our special offer on therapeutic massage sessions. Book now and receive 15% off your first session!',
      sentCount: 450,
      openRate: 0.42,
      bookings: 28,
      status: 'SENT',
      scheduledAt: new Date('2025-06-01'),
      sentAt: new Date('2025-06-01'),
    },
    {
      id: 'camp-002',
      name: 'New Patient Introduction',
      channel: ['EMAIL'],
      template: 'Welcome to PhysioCare! As a new patient, enjoy a complimentary initial assessment. Discover how we can help you move better and feel better.',
      sentCount: 120,
      openRate: 0.65,
      bookings: 45,
      status: 'SENT',
      scheduledAt: new Date('2025-05-15'),
      sentAt: new Date('2025-05-15'),
    },
    {
      id: 'camp-003',
      name: 'Sports Injury Workshop',
      channel: ['EMAIL', 'SMS', 'WHATSAPP'],
      template: 'Join us for a free workshop on preventing and managing common sports injuries. Led by our senior sports physiotherapist Dr. Sarah Johnson.',
      sentCount: 0,
      openRate: null,
      bookings: 0,
      status: 'DRAFT',
      scheduledAt: new Date('2025-08-01'),
      sentAt: null,
    },
  ];

  for (const camp of campaigns) {
    await prisma.marketingCampaign.create({
      data: {
        ...camp,
        tenantId: tenant.id,
      },
    });
  }

  // Create reminder rules
  const reminderRules = [
    {
      id: 'rule-001',
      trigger: '24H_BEFORE',
      channel: ['EMAIL'],
      template: 'Dear {patient}, this is a friendly reminder of your physiotherapy appointment on {date} at {time}. Please confirm or reschedule if needed.',
    },
    {
      id: 'rule-002',
      trigger: '2H_BEFORE',
      channel: ['SMS'],
      template: 'Reminder: Your appointment with {therapist} is in 2 hours at {time}. Reply CONFIRM to confirm or CALL to reschedule.',
    },
    {
      id: 'rule-003',
      trigger: 'NO_SHOW',
      channel: ['SMS'],
      template: 'We missed you at your appointment today. Please call us to reschedule. We look forward to helping you with your recovery.',
    },
  ];

  for (const rule of reminderRules) {
    await prisma.reminderRule.create({
      data: {
        ...rule,
        tenantId: tenant.id,
      },
    });
  }

  console.log('Seed completed successfully!');
  console.log(`  Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`  Admin: admin@physiocare.com / password123`);
  console.log(`  Therapist count: ${therapists.length}`);
  console.log(`  Patient count: ${patients.length}`);
  console.log(`  Appointment count: ${appointments.length}`);
  console.log(`  SOAP notes: ${completedAppts.length}`);
  console.log(`  Exercise plans: ${exercisePlans.length}`);
  console.log(`  Campaigns: ${campaigns.length}`);
  console.log(`  Reminder rules: ${reminderRules.length}`);

  // ========== New Demo Data: Notifications, Payments, Schemes, Treatment ==========

  const demoTenant = await prisma.tenant.findUnique({ where: { slug: 'physiocare-clinic' } });
  if (!demoTenant) throw new Error('Demo tenant not found');
  const tenantIdNew = demoTenant.id;

  const patientsNew = await prisma.patient.findMany({ where: { tenantId: tenantIdNew } });
  const therapistsNew = await prisma.therapist.findMany({ where: { tenantId: tenantIdNew }, include: { user: true } });
  const invoicesNew = await prisma.invoice.findMany({ where: { tenantId: tenantIdNew } });
  const adminUser2 = await prisma.user.findFirst({ where: { tenantId: tenantIdNew, role: 'ADMIN' } });
  const frontDeskUser2 = await prisma.user.findFirst({ where: { tenantId: tenantIdNew, role: 'FRONT_DESK' } });

  const templateData = [
    { name: '24h Appointment Reminder', trigger: 'APPOINTMENT_REMINDER_24H', channel: ['SMS', 'EMAIL'], subject: 'Appointment Reminder - Tomorrow', body: 'Hi {{patientName}}, this is a reminder of your appointment with {{therapistName}} tomorrow at {{time}}. Please arrive 15 minutes early. {{link}}' },
    { name: '2h Appointment Reminder', trigger: 'APPOINTMENT_REMINDER_2H', channel: ['SMS'], subject: null, body: 'Reminder: {{patientName}}, your appointment with {{therapistName}} is at {{time}} today. {{link}}' },
    { name: 'No Show Follow-up', trigger: 'NO_SHOW', channel: ['SMS', 'EMAIL'], subject: 'We missed you', body: 'Hi {{patientName}}, we missed you at your appointment. Please contact us to reschedule. {{link}}' },
    { name: 'Re-engagement', trigger: 'REENGAGEMENT', channel: ['EMAIL'], subject: 'We miss you!', body: 'Hi {{patientName}}, it has been a while since your last visit. We would love to help you continue your recovery. Book now: {{link}}' },
    { name: 'Task Assigned', trigger: 'TASK_ASSIGNED', channel: ['EMAIL'], subject: 'New Exercise Task', body: 'Hi {{patientName}}, you have a new task: {{taskTitle}}. {{taskDescription}}. Due: {{dueDate}}. {{link}}' },
    { name: 'Exercise Plan Sent', trigger: 'EXERCISE_PLAN_SENT', channel: ['EMAIL'], subject: 'Your Exercise Plan', body: 'Hi {{patientName}}, your new exercise plan is ready. View it here: {{link}}' },
  ];

  for (const tpl of templateData) {
    await prisma.notificationTemplate.upsert({
      where: { id: `seed-tpl-${tpl.trigger}` },
      update: tpl,
      create: { ...tpl, tenantId: tenantIdNew },
    });
  }

  await prisma.notificationChannel.upsert({
    where: { id: 'seed-chan-sms' },
    update: {},
    create: { tenantId: tenantIdNew, type: 'TWILIO_SMS', from: '+27123456789', isActive: true, config: {} },
  });
  await prisma.notificationChannel.upsert({
    where: { id: 'seed-chan-email' },
    update: {},
    create: { tenantId: tenantIdNew, type: 'RESEND_EMAIL', from: 'noreply@physiocare.com', isActive: true, config: {} },
  });
  await prisma.notificationChannel.upsert({
    where: { id: 'seed-chan-whatsapp' },
    update: {},
    create: { tenantId: tenantIdNew, type: 'TWILIO_WHATSAPP', from: '+14155238886', isActive: true, config: {} },
  });

  const paymentMethods = [
    { name: 'Cash', type: 'CASH' },
    { name: 'Credit Card', type: 'CARD', feePercent: 2.5 },
    { name: 'EFT', type: 'EFT' },
    { name: 'Debit Order', type: 'DEBIT_ORDER' },
    { name: 'Medical Aid', type: 'MEDICAL_AID' },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { id: `seed-pm-${pm.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: pm,
      create: { ...pm, tenantId: tenantIdNew },
    });
  }

  const schemes = [
    { name: 'Discovery Health', code: 'DISCOVERY', tariffVersion: '2024.1', contactNumber: '0860 123 456' },
    { name: 'Momentum Health', code: 'MOMENTUM', tariffVersion: '2024.1', contactNumber: '0860 456 789' },
    { name: 'Bonitas', code: 'BONITAS', tariffVersion: '2024.1', contactNumber: '0860 789 012' },
    { name: 'Medihelp', code: 'MEDIHELP', tariffVersion: '2024.0', contactNumber: '0860 111 222' },
    { name: 'Fedhealth', code: 'FEDHEALTH', tariffVersion: '2024.1', contactNumber: '0860 333 444' },
    { name: 'GEMS', code: 'GEMS', tariffVersion: '2024.2', contactNumber: '0860 555 666' },
  ];

  for (const s of schemes) {
    await prisma.medicalScheme.upsert({
      where: { tenantId_code: { tenantId: tenantIdNew, code: s.code } },
      update: s,
      create: { ...s, tenantId: tenantIdNew },
    });
  }

  const paidInvoices = invoicesNew.filter(inv => inv.status === 'PAID');
  const cashMethod = await prisma.paymentMethod.findFirst({ where: { tenantId: tenantIdNew, name: 'Cash' } });
  const cardMethod = await prisma.paymentMethod.findFirst({ where: { tenantId: tenantIdNew, name: 'Credit Card' } });
  const eftMethod = await prisma.paymentMethod.findFirst({ where: { tenantId: tenantIdNew, name: 'EFT' } });

  for (let i = 0; i < Math.min(paidInvoices.length, 20); i++) {
    const inv = paidInvoices[i];
    const method = i % 3 === 0 ? cashMethod : i % 3 === 1 ? cardMethod : eftMethod;
    await prisma.payment.upsert({
      where: { id: `seed-pay-${inv.id}` },
      update: {},
      create: {
        tenantId: tenantIdNew,
        invoiceId: inv.id,
        patientId: inv.patientId,
        amount: inv.total,
        paymentMethodId: method?.id || null,
        methodName: method?.name || 'Cash',
        reference: `REC-${inv.invoiceNumber}`,
        status: 'COMPLETED',
        paidAt: inv.paidAt || new Date(),
      },
    });
  }

  const submittedInvoices = invoicesNew.filter(inv => inv.status === 'SUBMITTED_TO_MEDICAL_AID' || inv.status === 'MEDICAL_AID_APPROVED');
  const schemes_list = await prisma.medicalScheme.findMany({ where: { tenantId: tenantIdNew } });

  for (let i = 0; i < submittedInvoices.length; i++) {
    const inv = submittedInvoices[i];
    const scheme = schemes_list[i % schemes_list.length];
    await prisma.schemeClaim.upsert({
      where: { id: `seed-claim-${inv.id}` },
      update: {},
      create: {
        tenantId: tenantIdNew,
        invoiceId: inv.id,
        patientId: inv.patientId,
        schemeId: scheme.id,
        tariffCode: '89999',
        amount: inv.total,
        status: inv.status === 'MEDICAL_AID_APPROVED' ? 'APPROVED' : 'SUBMITTED',
        submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        responseAt: inv.status === 'MEDICAL_AID_APPROVED' ? new Date() : undefined,
      },
    });
  }

  for (let i = 0; i < Math.min(patientsNew.length, 10); i++) {
    const patient = patientsNew[i];
    const therapist = therapistsNew[i % therapistsNew.length];
    const planStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'COMPLETED', 'ON_HOLD'];
    const status = planStatuses[i % planStatuses.length];

    await prisma.treatmentPlan.upsert({
      where: { id: `seed-tp-${patient.id}` },
      update: {},
      create: {
        tenantId: tenantIdNew,
        patientId: patient.id,
        name: `${patient.firstName}'s ${status === 'COMPLETED' ? 'Completed' : 'Active'} Treatment Plan`,
        diagnosis: status === 'COMPLETED' ? 'Lumbar disc herniation' : 'Mechanical low back pain',
        goals: [
          { description: 'Reduce pain to < 3/10', targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), achieved: status === 'COMPLETED' },
          { description: 'Return to full daily activities', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), achieved: status === 'COMPLETED' },
        ],
        status,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: status === 'COMPLETED' ? new Date() : null,
      },
    });
  }

  const plans = await prisma.treatmentPlan.findMany({ where: { tenantId: tenantIdNew } });
  for (const plan of plans) {
    const stageData = [
      { name: 'Acute Phase', description: 'Pain management and initial assessment', durationWeeks: 2, order: 0, status: plan.status === 'COMPLETED' ? 'COMPLETED' : 'COMPLETED' },
      { name: 'Recovery Phase', description: 'Strengthening and mobility exercises', durationWeeks: 4, order: 1, status: plan.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS' },
      { name: 'Maintenance Phase', description: 'Prevention and long-term management', durationWeeks: 8, order: 2, status: plan.status === 'COMPLETED' ? 'COMPLETED' : 'NOT_STARTED' },
    ];

    for (const stage of stageData) {
      await prisma.treatmentPlanStage.upsert({
        where: { id: `seed-stage-${plan.id}-${stage.order}` },
        update: {},
        create: { planId: plan.id, ...stage, startDate: new Date() },
      });
    }
  }

  const taskTypes = ['EXERCISE', 'MEDICATION', 'READING', 'ASSESSMENT'];
  const exerciseNames = ['Knee bends x 10', 'Shoulder stretches', 'Core stability holds', 'Walking 15 min', 'Balance exercises', 'Posture correction', 'Resistance band pulls', 'Ankle rotations'];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const patient = patientsNew[i % patientsNew.length];
    const therapist = therapistsNew[i % therapistsNew.length];
    const numTasks = 2 + (i % 3);

    for (let j = 0; j < numTasks; j++) {
      const taskType = taskTypes[(i + j) % taskTypes.length];
      const isCompleted = plan.status === 'COMPLETED' || (j === 0 && i < 3);

      await prisma.clientTask.upsert({
        where: { id: `seed-task-${plan.id}-${j}` },
        update: {},
        create: {
          tenantId: tenantIdNew,
          patientId: patient.id,
          therapistId: therapist.id,
          treatmentPlanId: plan.id,
          title: taskType === 'EXERCISE' ? exerciseNames[(i * numTasks + j) % exerciseNames.length] : `${taskType.charAt(0) + taskType.slice(1).toLowerCase()} task - ${patient.firstName}`,
          description: `Complete as instructed. ${taskType === 'EXERCISE' ? '3 sets of 10 repetitions.' : 'Follow the guidelines provided.'}`,
          taskType,
          dueDate: new Date(Date.now() + (j + 1) * 7 * 24 * 60 * 60 * 1000),
          completedAt: isCompleted ? new Date() : null,
          status: isCompleted ? 'COMPLETED' : 'PENDING',
          emailSentAt: j === 0 ? new Date() : null,
        },
      });
    }
  }

  const someAppointments = await prisma.appointment.findMany({
    where: { status: 'NO_SHOW', tenantId: tenantIdNew },
    take: 5,
  });

  for (const apt of someAppointments) {
    await prisma.followUp.upsert({
      where: { id: `seed-fu-${apt.id}` },
      update: {},
      create: {
        tenantId: tenantIdNew,
        patientId: apt.patientId,
        appointmentId: apt.id,
        therapistId: apt.therapistId,
        type: 'NO_SHOW',
        status: 'PENDING',
        followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  await prisma.$disconnect();
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
