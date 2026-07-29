import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Resolve a seed password from an env var, or generate a strong random one.
// Never hardcode credentials in source. The generated value is returned so it
// can be printed once for a fresh database.
function resolveSeedPassword(envVar) {
  const fromEnv = process.env[envVar];
  if (fromEnv) return { value: fromEnv, generated: false };
  const generated = crypto.randomBytes(18).toString('base64url');
  return { value: generated, generated: true };
}

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminCred = resolveSeedPassword('SEED_ADMIN_PASSWORD');
  const adminPassword = await bcrypt.hash(adminCred.value, 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@yorkcastle.edu.jm' },
    update: {},
    create: {
      email: 'admin@yorkcastle.edu.jm',
      password: adminPassword,
      name: 'System Administrator',
      role: 'ADMIN',
      phone: '+18769752217',
    },
  });

  // Create staff user
  const staffCred = resolveSeedPassword('SEED_STAFF_PASSWORD');
  const staffPassword = await bcrypt.hash(staffCred.value, 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@yorkcastle.edu.jm' },
    update: {},
    create: {
      email: 'staff@yorkcastle.edu.jm',
      password: staffPassword,
      name: 'Staff Member',
      role: 'STAFF',
      phone: '+18769752217',
    },
  });

  // Create sample courses
  const courses = [
    {
      name: 'Communication Studies',
      code: 'COMM001',
      pool: 1,
      description: 'Introduction to communication studies',
      capacity: 30,
    },
    {
      name: 'Caribbean Studies',
      code: 'CARB001',
      pool: 1,
      description: 'Caribbean history and culture',
      capacity: 30,
    },
    {
      name: 'Mathematics',
      code: 'MATH001',
      pool: 2,
      description: 'Advanced mathematics',
      capacity: 25,
    },
    {
      name: 'Physics',
      code: 'PHYS001',
      pool: 3,
      description: 'Physics principles and applications',
      capacity: 20,
    },
    {
      name: 'Chemistry',
      code: 'CHEM001',
      pool: 3,
      description: 'Chemistry fundamentals',
      capacity: 20,
    },
    {
      name: 'Biology',
      code: 'BIOL001',
      pool: 3,
      description: 'Biological sciences',
      capacity: 20,
    },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: {},
      create: course,
    });
  }

  // Create sample teachers
  const teachers = [
    {
      firstName: 'Raymon',
      lastName: 'Treasure',
      email: 'principal@yorkcastle.edu.jm',
      department: 'Administration',
      subjects: ['Administration'],
    },
    {
      firstName: 'D.',
      lastName: 'Robinson',
      department: 'Languages',
      subjects: ['Communication Studies'],
    },
    {
      firstName: 'D.',
      lastName: 'Hardware',
      department: 'Languages',
      subjects: ['Caribbean Studies'],
    },
  ];

  for (const teacher of teachers) {
    await prisma.teacher.upsert({
      where: { email: teacher.email || `teacher-${teacher.firstName}-${teacher.lastName}@yorkcastle.edu.jm` },
      update: {},
      create: teacher,
    });
  }

  // Create starter blog posts.
  // These target the searches families actually run - sixth form programmes,
  // how to apply, and what school life is like - and cross-link to the
  // relevant pages so those pages get picked up too.
  const blogPosts = [
    {
      slug: 'cape-associate-degree-programmes-york-castle-sixth-form',
      title: 'CAPE Associate Degree Programmes at York Castle High School Sixth Form',
      excerpt:
        'A guide to the ten CAPE Associate Degree pathways offered in Sixth Form at York Castle High School in Brown’s Town, St. Ann — from Natural Sciences and ICT to Law, Business and Tourism.',
      featuredImage: 'images/IMG_0813.webp',
      content: `
<p>Choosing a Sixth Form programme is one of the biggest decisions a Jamaican student makes. At <strong>York Castle High School</strong> in Brown&rsquo;s Town, St. Ann, our CAPE Associate Degree programmes are built to give students both a strong academic foundation and practical skills they can carry into university or straight into a career.</p>

<h2>What is a CAPE Associate Degree?</h2>
<p>The Caribbean Advanced Proficiency Examination (CAPE) is the regional qualification taken after CSEC, normally over two years in Lower and Upper Sixth. Students who complete an approved combination of CAPE units are awarded a CARICOM Associate Degree alongside their individual subject grades. For many students that means credit toward a university degree and a recognised qualification in hand.</p>

<figure class="blog-figure">
  <img src="images/IMG_0814.webp"
       srcset="images/IMG_0814-p-1080.jpeg 1080w, images/IMG_0814-p-1600.jpeg 1600w, images/IMG_0814.webp 2048w"
       sizes="(max-width: 768px) 92vw, 860px"
       width="2048" height="1365" loading="lazy" decoding="async"
       alt="York Castle High School graduands seated in cap and gown at the graduation ceremony">
  <figcaption>Graduation in the school hall. CAPE and the Associate Degree are the last step before university.</figcaption>
</figure>

<h2>The ten pathways we offer</h2>
<p>York Castle Sixth Form runs ten Associate Degree pathways, so students can specialise in the direction that suits them:</p>
<ul>
  <li><strong>Associate of Science &ndash; Natural Sciences</strong></li>
  <li><strong>Associate of Science &ndash; Information and Communication Technology</strong></li>
  <li><strong>Associate of Science &ndash; Industrial Technology</strong>, covering Building and Mechanical Engineering Drawing and Electrical and Electronic Technology</li>
  <li><strong>Associate of Arts in Business Studies &ndash; Entrepreneurship</strong></li>
  <li><strong>Associate of Arts in Humanities &ndash; Law</strong></li>
  <li><strong>Associate of Arts in Humanities &ndash; Sociology</strong></li>
  <li><strong>Associate of Arts in Humanities &ndash; Visual Communication</strong></li>
  <li><strong>Associate of Arts in Humanities &ndash; Tourism</strong></li>
  <li><strong>Associate of Arts in Humanities &ndash; Food and Nutrition</strong></li>
  <li><strong>Associate of Arts in Humanities &ndash; Sports Studies</strong></li>
</ul>
<p>You can read the full description of each programme on our <a href="courses.html">Sixth Form courses page</a>.</p>

<h2>Choosing the right pathway</h2>
<p>Start from where the student wants to end up rather than from the subjects they find easiest. A student aiming at medicine or engineering will want Natural Sciences or Industrial Technology; one aiming at law school or the public sector will be better served by the Law or Sociology pathway. Our <a href="info-on-colleges.html">information on colleges</a> page sets out where our graduates typically go on to study, and the <a href="teachers.html">staff directory</a> shows who teaches in each department.</p>

<h2>How to apply</h2>
<p>Applications for Sixth Form are made through our <a href="sixth-form-application.html">online Sixth Form application form</a>. Once submitted, you can follow the progress of your application at any time using the <a href="application-status.html">application status page</a>. If you need to talk through your options first, <a href="contact-us.html">contact the school office</a> on +1 876 975-2217.</p>

<p><em>Nil Sine Magno Labore</em> &mdash; nothing is achieved without hard work.</p>
`.trim(),
    },
    {
      slug: 'how-to-apply-to-york-castle-high-school',
      title: 'How to Apply to York Castle High School: A Guide for Parents and Students',
      excerpt:
        'Everything you need to apply to York Castle High School — the forms to use for Grade 7 and Sixth Form entry, how to check your application status, and how to request student records.',
      featuredImage: 'images/IMG_0814.webp',
      content: `
<p>Applying to a new school can feel like a lot of paperwork. This guide walks through how admission to <strong>York Castle High School</strong> works, which form you need, and what happens after you submit it. Everything below can be done online.</p>

<h2>About the school</h2>
<p>York Castle High School is a Methodist co-educational secondary school in Brown&rsquo;s Town, St. Ann, established in 1914. We serve students from Grade 7 through Grade 13, preparing them for CSEC and CAPE examinations while placing equal weight on character, service and leadership. You can read more about our <a href="history.html">history</a> and our <a href="mission-and-vision.html">mission and vision</a>.</p>

<figure class="blog-figure">
  <img src="images/IMG_0791.webp"
       srcset="images/IMG_0791-p-500.jpeg 500w, images/IMG_0791-p-800.jpeg 800w, images/IMG_0791.webp 1080w"
       sizes="(max-width: 768px) 92vw, 860px"
       width="1080" height="1080" loading="lazy" decoding="async"
       alt="York Castle High School cheerleaders performing on the school field on sports day">
  <figcaption>Sports day on the school field at Brown&rsquo;s Town.</figcaption>
</figure>

<h2>Entry at Grade 7</h2>
<p>Most students join us in Grade 7 through the national placement process administered by the Ministry of Education and Youth. Families who need to apply to the school directly &mdash; including transfer students moving from another institution &mdash; should use our <a href="application-form.html">general admission form</a>, which walks you through each section step by step.</p>

<h2>Entry at Sixth Form</h2>
<p>Students entering Lower Sixth, whether continuing from Grade 11 at York Castle or joining us from another school, apply through the <a href="sixth-form-application.html">Sixth Form application form</a>. Before you apply, it is worth reading through the <a href="courses.html">CAPE Associate Degree programmes</a> so you can choose your pathway with confidence.</p>

<h2>After you apply</h2>
<p>You do not need to call the office to find out where things stand. Use the <a href="application-status.html">check application status</a> page to see your progress, and to update your CSEC results when they are published.</p>

<h2>Other requests</h2>
<ul>
  <li><a href="request-student-information.html">Request student information</a> &mdash; transcripts, references and confirmation of attendance for past and present students.</li>
  <li><a href="booklist.html">Booklists</a> &mdash; the required texts for each grade.</li>
  <li><a href="request.html">General request form</a> &mdash; for anything else the office can help with.</li>
</ul>

<h2>Still have questions?</h2>
<p>Our office is happy to help. Call +1 876 975-2217, email <a href="mailto:yorkcastle.high.san@moey.gov.jm">yorkcastle.high.san@moey.gov.jm</a>, or use the <a href="contact-us.html">contact page</a>. Please check the school <a href="calendar.html">calendar</a> for term dates and upcoming open events.</p>
`.trim(),
    },
    {
      slug: 'student-life-at-york-castle-houses-clubs-and-sport',
      title: 'Student Life at York Castle: Houses, Clubs and Sport in Brown’s Town',
      excerpt:
        'Beyond the classroom, York Castle students compete for four historic houses, serve their community through Key Club and Interact, and represent the school in football, cricket and track and field.',
      featuredImage: 'images/IMG_0808.webp',
      content: `
<p>Ask a Yorkist what they remember about school and they rarely start with a syllabus. At <strong>York Castle High School</strong> we set out to develop the whole person &mdash; mentally, physically, socially and spiritually &mdash; and a great deal of that happens outside timetabled lessons.</p>

<h2>Four houses, one school</h2>
<p>Every student belongs to one of four houses, each named for someone who helped build secondary education in Brown&rsquo;s Town:</p>
<ul>
  <li><strong>Murray House</strong>, for Dr. William Clarke Murray, Governor of the old York Castle, who served the school from 1882 to 1886.</li>
  <li><strong>Curphey House</strong>, for Dr. the Hon. Sir Adlington G. Curphey &mdash; surgeon, Custos of the parish, and an old boy of the first York Castle, who was pivotal in raising the funds that established the present school.</li>
  <li><strong>Bramwell House</strong>, for Mr. Theophilus A. Bramwell, founder and headmaster of Middlesex High School, which laid the foundations for co-education in Brown&rsquo;s Town.</li>
  <li><strong>Henderson House</strong>, for the Rev. George Henderson, a former pastor of the Brown&rsquo;s Town Baptist Church whose service to Middlesex High School advanced secondary education in the area.</li>
</ul>
<p>House competition runs through the year and comes to a head at sports day. More on each house is on our <a href="houses.html">houses page</a>.</p>

<figure class="blog-figure">
  <img src="images/IMG_0791.webp"
       srcset="images/IMG_0791-p-500.jpeg 500w, images/IMG_0791-p-800.jpeg 800w, images/IMG_0791.webp 1080w"
       sizes="(max-width: 768px) 92vw, 860px"
       width="1080" height="1080" loading="lazy" decoding="async"
       alt="Cheerleaders in York Castle gold performing during an inter-house sports meet">
  <figcaption>House competition runs all year and comes to a head on sports day.</figcaption>
</figure>

<h2>Clubs and societies</h2>
<p>Our <a href="clubs.html">clubs and societies</a> give students a way to lead and to serve:</p>
<ul>
  <li><strong>Key Club</strong>, affiliated to Kiwanis International, serving both the school and the wider community and building character through altruistic service.</li>
  <li><strong>United Nations Club</strong>, for students interested in international affairs &mdash; the environment, human rights, poverty eradication and the culture of peace.</li>
  <li><strong>Interact Club</strong>, which builds self-awareness and self-esteem through socialisation with peers.</li>
</ul>
<p>Students also write and produce <em>YC HIVE</em>, the school magazine.</p>

<h2>Sport</h2>
<p>York Castle competes in <strong>football</strong>, <strong>cricket</strong> and <strong>track and field</strong>, among other disciplines. The aim is not only competition: sport at York Castle is about belonging to a team, developing leadership, and building friendships across the year groups. See the full list on our <a href="sports-and-extra-curricular-activities.html">sports and extra-curricular activities</a> page.</p>

<figure class="blog-figure blog-figure-portrait">
  <img src="images/IMG_0808.webp"
       srcset="images/IMG_0808-p-500.jpeg 500w, images/IMG_0808-p-800.jpeg 800w, images/IMG_0808-p-1080.jpeg 1080w"
       sizes="(max-width: 768px) 92vw, 860px"
       width="1365" height="2048" loading="lazy" decoding="async"
       alt="Two York Castle cadets playing snare drums as the marching band moves through the campus">
  <figcaption>The cadet corps marching band on campus.</figcaption>
</figure>

<h2>Come and see for yourself</h2>
<p>Photographs from around campus are in our <a href="gallery.html">gallery</a>, and recent achievements are collected under <a href="student-highlights.html">student highlights</a>. If you are considering York Castle for your child, our <a href="application-form.html">admission form</a> is online, and the office can be reached on +1 876 975-2217.</p>
`.trim(),
    },
  ];

  // A plain re-seed must never overwrite copy that staff have since edited,
  // so existing rows are left alone unless this is set explicitly:
  //   SEED_FORCE_UPDATE=true npm run db:seed
  // Even then, published/publishedAt/authorId are deliberately excluded so a
  // re-seed can't unpublish a live post or reset its date.
  const forceUpdate = process.env.SEED_FORCE_UPDATE === 'true';

  const publishedAt = new Date();
  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: forceUpdate
        ? {
            title: post.title,
            excerpt: post.excerpt,
            content: post.content,
            featuredImage: post.featuredImage,
          }
        : {},
      create: {
        ...post,
        published: true,
        publishedAt,
        authorId: admin.id,
      },
    });
  }

  console.log(
    `Seeded ${blogPosts.length} blog posts` +
      (forceUpdate ? ' (existing rows updated).' : ' (existing rows left unchanged).')
  );

  console.log('Database seeded successfully!');
  console.log('Admin email: admin@yorkcastle.edu.jm');
  if (adminCred.generated) {
    console.log(`Admin password (generated - save this now): ${adminCred.value}`);
    console.log('Tip: set SEED_ADMIN_PASSWORD in the environment to choose your own.');
  } else {
    console.log('Admin password: set via SEED_ADMIN_PASSWORD environment variable.');
  }
  console.log('Staff email: staff@yorkcastle.edu.jm');
  if (staffCred.generated) {
    console.log(`Staff password (generated - save this now): ${staffCred.value}`);
    console.log('Tip: set SEED_STAFF_PASSWORD in the environment to choose your own.');
  } else {
    console.log('Staff password: set via SEED_STAFF_PASSWORD environment variable.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





