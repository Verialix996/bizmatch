/**
 * BizMatch — Railway MySQL seed script
 *
 * Wipes the DB and rebuilds with:
 *   25 investors  (sarah.chen@bizmatch.app, etc.)
 *   25 entrepreneurs (alex.rivera@bizmatch.app, etc.)
 *    6 pre-made mutual matches with chat histories
 *
 * All passwords: Demo1234!
 *
 * Usage:
 *   DATABASE_URL="mysql://user:pass@host:port/db" node backend/scripts/seed.js
 *   — or —
 *   Set DATABASE_URL in backend/.env, then: node backend/scripts/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

const DROP_ORDER = [
  'messages', 'meetings', 'project_ndas', 'partner_invitations',
  'project_partners', 'project_matches', 'project_swipes',
  'ai_match_scores', 'swipes', 'matches', 'projects', 'profiles',
  'api_usage', 'users', 'schema_migrations',
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var is not set.');
  process.exit(1);
}

const PASSWORD_HASH = bcrypt.hashSync('Demo1234!', 10);

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const INVESTORS = [
  { name: 'Sarah Chen',      email: 'sarah.chen@bizmatch.app',      domain: 'SaaS,B2B Software',            stage: 'mvp',    max: 500000,  bio: 'Early-stage SaaS investor with 12 years backing B2B software companies. Former product lead at Salesforce. I write the first check and sit on the board.' },
  { name: 'Marcus Webb',     email: 'marcus.webb@bizmatch.app',      domain: 'FinTech,Payments',             stage: 'growth', max: 2000000, bio: 'Partner at Meridian Ventures. Focused on fintech infrastructure and payments. Previously built and sold a payment processing startup.' },
  { name: 'Lena Fischer',    email: 'lena.fischer@bizmatch.app',     domain: 'HealthTech,MedTech',           stage: 'idea',   max: 150000,  bio: 'Angel investor and former ER physician. Backing founders who are fixing healthcare with technology. Love capital-efficient teams.' },
  { name: 'David Okafor',    email: 'david.okafor@bizmatch.app',     domain: 'Marketplace,eCommerce',        stage: 'mvp',    max: 750000,  bio: 'Operator-turned-investor. I built two marketplace startups and now back the next generation. Strong network in logistics and supply chain.' },
  { name: 'Priya Nair',      email: 'priya.nair@bizmatch.app',       domain: 'EdTech,Future of Work',        stage: 'mvp',    max: 300000,  bio: 'EdTech-focused investor and ex-Coursera. Passionate about upskilling and workforce development in emerging markets.' },
  { name: 'James Harrington',email: 'james.h@bizmatch.app',          domain: 'DeepTech,AI,Robotics',         stage: 'growth', max: 5000000, bio: 'Led deep tech investments at two Tier-1 VCs. MIT AI Lab alum. Looking for founders who are 5 years ahead of the market.' },
  { name: 'Amara Diallo',    email: 'amara.diallo@bizmatch.app',     domain: 'CleanTech,Sustainability',     stage: 'idea',   max: 200000,  bio: 'Impact investor focused on climate and sustainability. Former UNDP. I back founders solving real environmental problems with scalable tech.' },
  { name: 'Tom Eriksson',    email: 'tom.eriksson@bizmatch.app',     domain: 'Gaming,Entertainment',         stage: 'mvp',    max: 600000,  bio: 'Gaming and interactive media investor. Former EA exec. I have deep relationships with publishers, studios and distribution platforms.' },
  { name: 'Nina Suzuki',     email: 'nina.suzuki@bizmatch.app',      domain: 'Consumer,D2C,Brand',           stage: 'growth', max: 3000000, bio: 'Consumer brand specialist. Led Series A rounds for 4 D2C brands that reached $100M+ ARR. Board member at two retail-tech companies.' },
  { name: 'Carlos Mendez',   email: 'carlos.mendez@bizmatch.app',    domain: 'PropTech,Construction',        stage: 'mvp',    max: 800000,  bio: 'PropTech investor and real estate developer. Backing founders modernising construction, property management, and the built environment.' },
  { name: 'Rachel Kim',      email: 'rachel.kim@bizmatch.app',       domain: 'BioTech,Life Sciences',        stage: 'idea',   max: 400000,  bio: 'Biotech angel and PhD biochemist. I evaluate the science before the pitch deck. Focused on diagnostics and drug discovery platforms.' },
  { name: 'Felix Wagner',    email: 'felix.wagner@bizmatch.app',     domain: 'Crypto,Web3,DeFi',             stage: 'mvp',    max: 500000,  bio: 'Web3 native investor. Early LP in multiple DeFi protocols. I look for founders who understand regulatory risk and build accordingly.' },
  { name: 'Sophie Laurent',  email: 'sophie.laurent@bizmatch.app',   domain: 'FashionTech,Retail',           stage: 'mvp',    max: 350000,  bio: 'Fashion-tech investor and former LVMH digital strategy. Backing the next generation of sustainable fashion and retail innovation.' },
  { name: 'Kwame Asante',    email: 'kwame.asante@bizmatch.app',     domain: 'AgriTech,FoodTech',            stage: 'growth', max: 2500000, bio: 'AgriTech investor focused on food security in Africa and Southeast Asia. I back founders who understand both technology and farming realities.' },
  { name: 'Elena Popova',    email: 'elena.popova@bizmatch.app',     domain: 'CyberSecurity,Enterprise',     stage: 'mvp',    max: 700000,  bio: 'Enterprise security investor. Former CISO at a Fortune 500. I evaluate security products with the eye of a practitioner, not just an investor.' },
  { name: 'Ben Shapiro',     email: 'ben.shapiro@bizmatch.app',      domain: 'HR Tech,Future of Work',       stage: 'idea',   max: 180000,  bio: 'HR tech angel. Backed 12 workforce software startups. I bring recruiting, talent and people ops networks to every portfolio company.' },
  { name: 'Yuki Tanaka',     email: 'yuki.tanaka@bizmatch.app',      domain: 'Mobility,Autonomous,EV',       stage: 'growth', max: 4000000, bio: 'Mobility and autonomous vehicles investor. Former Toyota Ventures. I back the full mobility stack from software to charging infrastructure.' },
  { name: 'Isabel Ferreira', email: 'isabel.ferreira@bizmatch.app',  domain: 'LegalTech,RegTech',            stage: 'mvp',    max: 450000,  bio: 'LegalTech investor and former BigLaw partner. I help legal and compliance startups navigate the regulatory landscape from day one.' },
  { name: 'Omar Hassan',     email: 'omar.hassan@bizmatch.app',      domain: 'InsurTech,Risk',               stage: 'mvp',    max: 600000,  bio: 'InsurTech and risk technology investor. Former Zurich Group actuary. I understand insurance deeply and can open carrier distribution doors.' },
  { name: 'Claudia Rossi',   email: 'claudia.rossi@bizmatch.app',    domain: 'TravelTech,Hospitality',       stage: 'growth', max: 1800000, bio: 'Travel tech investor and former Booking.com head of partnerships. Strong network across OTAs, airlines and hotel chains globally.' },
  { name: 'Nathan Brooks',   email: 'nathan.brooks@bizmatch.app',    domain: 'SaaS,DevTools,Infrastructure', stage: 'idea',   max: 250000,  bio: 'Dev tools and infrastructure angel. Previously staff engineer at AWS. I back developer-first products and PLG growth models.' },
  { name: 'Fatima Al-Rashid',email: 'fatima.ar@bizmatch.app',        domain: 'Social Impact,FinTech',        stage: 'mvp',    max: 400000,  bio: 'Impact investor focused on financial inclusion. Backed microfinance and alternative credit startups across the MENA region.' },
  { name: 'George Petrov',   email: 'george.petrov@bizmatch.app',    domain: 'AI,Machine Learning,Data',     stage: 'growth', max: 3500000, bio: 'AI/ML investor. PhD Stanford, former Google Brain researcher. I can evaluate the technical depth of AI products — no hand-waving allowed.' },
  { name: 'Lisa Montgomery', email: 'lisa.montgomery@bizmatch.app',  domain: 'Media,Content,Creator Economy',stage: 'mvp',   max: 550000,  bio: 'Media and creator economy investor. Former Spotify head of content partnerships. I help media startups build sustainable business models.' },
  { name: 'Henry Zhou',      email: 'henry.zhou@bizmatch.app',       domain: 'Manufacturing,Industry 4.0',   stage: 'growth', max: 2200000, bio: 'Industrial tech investor. Backed 6 Industry 4.0 companies including two unicorns. Strong relationships with manufacturing conglomerates in Asia.' },
];

const ENTREPRENEURS = [
  { name: 'Alex Rivera',     email: 'alex.rivera@bizmatch.app',    title: 'TeamSync',      industry: 'SaaS',          stage: 'mvp',    needs: 400000,  skills: ['SaaS','Product Management','Engineering'],              hobbies: ['chess','running','gaming'],         bio: 'Ex-Google engineer building the async collaboration tool remote teams actually love. TeamSync combines video updates, task threads and AI meeting summaries. 800 paying teams after 6 months.' },
  { name: 'Mia Johnson',     email: 'mia.johnson@bizmatch.app',    title: 'CashBridge',    industry: 'FinTech',        stage: 'growth', needs: 2000000, skills: ['FinTech','Mobile','Growth Hacking'],                    hobbies: ['cooking','travel','reading'],       bio: 'CEO of CashBridge, bringing banking to 1.4B unbanked adults in Southeast Asia. Revenue positive, processing $3M monthly. Looking for a Series A partner who believes financial inclusion is a real market.' },
  { name: 'Jordan Lee',      email: 'jordan.lee@bizmatch.app',     title: 'VitalBand',     industry: 'HealthTech',     stage: 'idea',   needs: 120000,  skills: ['Hardware','Machine Learning','BioSignals'],             hobbies: ['cycling','yoga','podcasts'],        bio: 'MD and ML engineer building a wearable that predicts health events 48 hours before symptoms appear. First prototype detects atrial fibrillation with 94% accuracy. Raising pre-seed to finish FDA validation.' },
  { name: 'Zara Ahmed',      email: 'zara.ahmed@bizmatch.app',     title: 'LearnArc',      industry: 'EdTech',         stage: 'growth', needs: 1500000, skills: ['EdTech','Content','Community Building'],               hobbies: ['chess','hiking','teaching'],        bio: 'Serial entrepreneur on my third venture. LearnArc is an adaptive learning platform with 28k active students across 40 countries. Raised $400k, now scaling. Strong education policy network in MENA and South Asia.' },
  { name: 'Ethan Park',      email: 'ethan.park@bizmatch.app',     title: 'ArtisanRoute',  industry: 'Marketplace',    stage: 'mvp',    needs: 500000,  skills: ['Marketplace','Logistics','Community'],                  hobbies: ['football','cooking','music'],       bio: 'Connecting African artisans to global buyers. 340 sellers across 12 countries, shipping to 40 destinations. Average seller earns 3x their local market rate. Profitable unit economics, seeking seed to expand to Latin America.' },
  { name: 'Nadia Okonkwo',   email: 'nadia.okonkwo@bizmatch.app',  title: 'BuildLedger',   industry: 'PropTech',       stage: 'mvp',    needs: 600000,  skills: ['PropTech','Construction Tech','Finance'],               hobbies: ['tennis','architecture','reading'],  bio: 'Replacing spreadsheets in construction with AI-powered cost tracking and subcontractor payments. Pilot with 3 mid-size contractors managing $120M in projects. Ex-Procore, I know this industry inside out.' },
  { name: 'Sam Torres',      email: 'sam.torres@bizmatch.app',     title: 'GreenRoute',    industry: 'CleanTech',      stage: 'idea',   needs: 200000,  skills: ['Sustainability','Logistics','Carbon Markets'],          hobbies: ['cycling','hiking','cooking'],       bio: 'Building carbon-neutral last-mile delivery for e-commerce. Fleet of e-cargo bikes in 3 cities, 12,000 deliveries, zero emissions. Talking to two major retailers for pilot. Need capital to expand the fleet.' },
  { name: 'Bella Martinez',  email: 'bella.martinez@bizmatch.app', title: 'StyleShift',    industry: 'FashionTech',    stage: 'mvp',    needs: 350000,  skills: ['Fashion','Computer Vision','D2C'],                     hobbies: ['design','music','travel'],          bio: 'AI-powered virtual try-on for fashion e-commerce. Brands using StyleShift see 34% fewer returns and 18% higher conversion. 8 brand clients paying monthly, pipeline of 40 more. Second-time founder.' },
  { name: 'Omar Farouq',     email: 'omar.farouq@bizmatch.app',    title: 'CropSense',     industry: 'AgriTech',       stage: 'mvp',    needs: 450000,  skills: ['AgriTech','IoT','Data Science'],                        hobbies: ['football','farming','chess'],       bio: 'IoT sensors + AI giving smallholder farmers real-time soil and crop health data. Deployed on 1,200 farms across Kenya and Tanzania. Farmers using CropSense report 28% yield increases. Expanding to West Africa.' },
  { name: 'Talia Schwartz',  email: 'talia.schwartz@bizmatch.app', title: 'LegalFlow',     industry: 'LegalTech',      stage: 'mvp',    needs: 500000,  skills: ['LegalTech','AI','Document Automation'],                 hobbies: ['running','law','reading'],          bio: 'Automating contract review for in-house legal teams at mid-market companies. LegalFlow cuts contract review time by 70%. 22 paying customers, $40k MRR, growing 15% month over month.' },
  { name: 'Kai Nakamura',    email: 'kai.nakamura@bizmatch.app',   title: 'ShiftWork',     industry: 'HR Tech',        stage: 'idea',   needs: 180000,  skills: ['HR Tech','Scheduling','Mobile'],                        hobbies: ['gaming','music','travel'],          bio: 'Scheduling and payroll platform for hourly workers and their employers. Solving the #1 pain point for restaurants, retail and warehouses. 40 employer pilots, 1,200 workers onboarded.' },
  { name: 'Grace Obi',       email: 'grace.obi@bizmatch.app',      title: 'MedVerify',     industry: 'HealthTech',     stage: 'mvp',    needs: 700000,  skills: ['HealthTech','AI','Drug Discovery'],                     hobbies: ['research','yoga','cooking'],        bio: 'AI platform accelerating drug discovery by predicting molecular interactions. PhD biochemist + ML researcher. First partnership with a Tier-2 pharma company signed. Pre-clinical validation underway.' },
  { name: 'Luca Bianchi',    email: 'luca.bianchi@bizmatch.app',   title: 'TrustLayer',    industry: 'CyberSecurity',  stage: 'mvp',    needs: 600000,  skills: ['CyberSecurity','Zero Trust','Enterprise'],              hobbies: ['chess','hiking','coding'],          bio: 'Zero-trust identity platform for mid-market enterprises. Replaces VPN with continuous authentication. 15 enterprise clients, $55k MRR. Former NSA engineer who spotted this gap from the inside.' },
  { name: 'Anya Volkov',     email: 'anya.volkov@bizmatch.app',    title: 'PixelStudio',   industry: 'AI/Creative',    stage: 'growth', needs: 1500000, skills: ['Generative AI','Creative Tools','API Products'],       hobbies: ['art','gaming','music'],             bio: 'Generative AI toolset for professional video editors and motion designers. 4,000 paying subscribers at $49/month, growing 25% MoM. API business just launched with 3 studio partners.' },
  { name: 'Dev Patel',       email: 'dev.patel@bizmatch.app',      title: 'InsureBot',     industry: 'InsurTech',      stage: 'mvp',    needs: 500000,  skills: ['InsurTech','AI','Claims Processing'],                   hobbies: ['cricket','finance','reading'],      bio: 'AI-powered claims processing for property & casualty insurers. Cut claims processing time from 14 days to 4 hours. Pilot with a regional insurer managing 8,000 claims per month.' },
  { name: 'Chloe Dubois',    email: 'chloe.dubois@bizmatch.app',   title: 'RentEasy',      industry: 'PropTech',       stage: 'mvp',    needs: 400000,  skills: ['PropTech','Rental Market','Mobile'],                    hobbies: ['design','travel','reading'],        bio: 'End-to-end rental platform for the French market, expanding to Southern Europe. Digital lease signing, rent collection and maintenance tracking in one app. 800 landlords, 2,400 tenants.' },
  { name: 'Tobias Müller',   email: 'tobias.muller@bizmatch.app',  title: 'DataRoom Pro',  industry: 'SaaS',           stage: 'idea',   needs: 250000,  skills: ['SaaS','Data Rooms','Investor Relations'],              hobbies: ['chess','skiing','running'],         bio: 'Modern virtual data room for startup fundraising. Founders share financials, cap tables and due diligence documents with investors through a clean, secure interface. 120 startups used us for their last round.' },
  { name: 'Amira Khalil',    email: 'amira.khalil@bizmatch.app',   title: 'Tabib',         industry: 'HealthTech',     stage: 'mvp',    needs: 600000,  skills: ['HealthTech','Telemedicine','Arabic Markets'],           hobbies: ['medicine','travel','chess'],        bio: 'Telemedicine platform for the Arabic-speaking world. 12,000 patients connected to 400 licensed doctors across 8 MENA countries. Regulatory approvals in 4 countries. Expanding into Sudan and Libya.' },
  { name: 'Finn Larsson',    email: 'finn.larsson@bizmatch.app',   title: 'CodeCoach',     industry: 'EdTech',         stage: 'growth', needs: 1200000, skills: ['EdTech','Coding Education','Job Placement'],           hobbies: ['gaming','music','coding'],          bio: 'Coding bootcamp with an AI tutor that adapts to each learner. 82% job placement rate within 6 months. 600 graduates, $2.1M revenue last year. Series A to expand live cohorts to 4 new cities.' },
  { name: 'Rania Mansour',   email: 'rania.mansour@bizmatch.app',  title: 'GreenBite',     industry: 'FoodTech',       stage: 'mvp',    needs: 450000,  skills: ['FoodTech','Supply Chain','Sustainability'],            hobbies: ['cooking','sustainability','yoga'],  bio: 'Plant-based protein supply chain platform connecting alternative protein producers to food brands and retailers. Onboarded 14 producers, $1.2M in transactions facilitated. Building the Bloomberg for alt-protein pricing.' },
  { name: 'Victor Santos',   email: 'victor.santos@bizmatch.app',  title: 'FleetAI',       industry: 'Mobility',       stage: 'mvp',    needs: 700000,  skills: ['Mobility','Telematics','Fleet Management'],            hobbies: ['football','cars','travel'],         bio: 'AI-powered fleet management for logistics companies. Real-time route optimisation, predictive maintenance and driver coaching. 3 logistics clients, 280 vehicles tracked. Saving clients 22% on fuel costs.' },
  { name: 'Mei Lin',         email: 'mei.lin@bizmatch.app',        title: 'GiftMind',      industry: 'Consumer',       stage: 'mvp',    needs: 300000,  skills: ['Consumer','AI','Personalisation'],                      hobbies: ['design','cooking','gaming'],        bio: 'AI gift recommendation engine for enterprise employee gifting. HR teams use GiftMind to send personalised gifts at scale. 35 corporate clients, $180k ARR, NPS of 72.' },
  { name: 'Arjun Mehta',     email: 'arjun.mehta@bizmatch.app',    title: 'PolicyPal',     industry: 'RegTech',        stage: 'growth', needs: 1800000, skills: ['RegTech','Compliance Automation','LLMs'],              hobbies: ['cricket','law','chess'],            bio: 'LLM-powered regulatory compliance platform for financial services. Monitors 3,000+ regulatory sources across 22 jurisdictions, surfaces actionable changes. 18 bank and asset manager clients. $280k MRR.' },
  { name: 'Elisa Conti',     email: 'elisa.conti@bizmatch.app',    title: 'TasteMap',      industry: 'TravelTech',     stage: 'mvp',    needs: 350000,  skills: ['TravelTech','Food','Community'],                        hobbies: ['travel','cooking','photography'],   bio: 'Hyper-local food discovery app built by locals for travellers. 14,000 recommendations curated by verified food experts in 120 cities. Monetising through experiences, restaurant partnerships and a premium tier.' },
  { name: 'Stefan Wolff',    email: 'stefan.wolff@bizmatch.app',   title: 'ChainAudit',    industry: 'Web3',           stage: 'idea',   needs: 220000,  skills: ['Smart Contracts','Security Auditing','Web3'],          hobbies: ['coding','chess','hiking'],          bio: 'Automated smart contract auditing platform. Combines static analysis with AI to detect vulnerabilities. 40 audit reports completed, $180k revenue, 0 critical issues missed. Building the standard in on-chain security.' },
];

const MATCH_PAIRS = [
  { inv: 'sarah.chen@bizmatch.app',    ent: 'alex.rivera@bizmatch.app',    chat: [
    { from: 'inv', msg: "Hi Alex! TeamSync caught my eye — B2B SaaS at $50/team/month with 800 paying customers is impressive traction. Tell me more about retention." },
    { from: 'ent', msg: "Thanks Sarah! Monthly churn is 2.1% which we\'re actively working to improve. Annual contracts are stickier — 96% renewal rate there. The big unlock was adding AI meeting summaries which teams now say is their favourite feature." },
    { from: 'inv', msg: "That annual renewal number is strong. What does your expansion revenue look like? Are teams adding seats over time?" },
    { from: 'ent', msg: "Net revenue retention is 118% — teams start with 5-10 seats and grow to 20-30 as they onboard more departments. Sales is entirely inbound right now which is why I\'m excited to bring on capital to build an outbound motion." },
  ]},
  { inv: 'marcus.webb@bizmatch.app',   ent: 'mia.johnson@bizmatch.app',    chat: [
    { from: 'inv', msg: "Mia, $3M monthly processing and revenue positive in fintech — that\'s rare. How are you thinking about the regulatory moat as you expand countries?" },
    { from: 'ent', msg: "We partner with local licensed banks in each market rather than getting direct licenses, which is 10x faster to launch. We hold no customer funds ourselves. The moat is our local bank network and the trust we\'ve built with communities that other apps haven\'t touched." },
    { from: 'inv', msg: "Smart structure. What\'s your take rate and how does it compare to incumbents?" },
    { from: 'ent', msg: "We charge 1.8% on transfers vs the 5-8% that Western Union and local agents charge. Even at our rate we\'re dramatically cheaper and the convenience is incomparable. Gross margin is 62% once you strip out payment processing costs." },
  ]},
  { inv: 'lena.fischer@bizmatch.app',  ent: 'jordan.lee@bizmatch.app',     chat: [
    { from: 'inv', msg: "Jordan — as a physician investor this is exactly what I look for. 94% AFib detection accuracy is publishable. Where are you in the FDA pathway?" },
    { from: 'ent', msg: "We\'re pursuing De Novo classification which is typically 12-18 months. We have a regulatory consultant who worked at FDA for 8 years guiding us. The pre-submission meeting went well — no major red flags. We\'re building the clinical evidence package now." },
    { from: 'inv', msg: "The pre-sub meeting result is the key signal I needed. What does the $120k pre-seed cover specifically?" },
    { from: 'ent', msg: "It covers the 510k-equivalent clinical study (40 patients, 3 sites), miniaturisation of the prototype, and 6 months runway for myself and my co-founder who is handling the ML side. We close pre-seed by end of Q2 and expect to have FDA clearance within 18 months of that." },
  ]},
  { inv: 'david.okafor@bizmatch.app',  ent: 'ethan.park@bizmatch.app',     chat: [
    { from: 'inv', msg: "Ethan, marketplace unit economics are my speciality. Walk me through your take rate and seller payback period." },
    { from: 'ent', msg: "We take 12% on each transaction. Sellers pay nothing to list. Average seller does $800/month in sales on the platform, earning $704 net after our fee. A seller who earns $30/month locally now earns $700+ — that\'s transformational income. Seller acquisition cost is $45 and payback is under 2 months." },
    { from: 'inv', msg: "CAC payback under 2 months is excellent. What\'s your buyer-side retention looking like? That\'s usually the harder side of the marketplace." },
    { from: 'ent', msg: "Buyer 6-month retention is 61%, which we know needs work. We\'re building a subscription \'curated box\' product to create a recurring relationship. Buyers who subscribe retain at 89%. That\'s what the seed round is primarily funding — the subscription product and buyer acquisition." },
  ]},
  { inv: 'priya.nair@bizmatch.app',    ent: 'zara.ahmed@bizmatch.app',     chat: [
    { from: 'inv', msg: "Zara, your traction in EdTech is outstanding. 28k students across 40 countries without raising a Series A is impressive. What\'s your business model?" },
    { from: 'ent', msg: "We charge institutions (universities and corporate training departments) a per-seat SaaS fee of $12/month. 40% of revenue comes from direct B2C subscriptions at $8/month. The institutional channel is where we see the best LTV — average contract is 3 years." },
    { from: 'inv', msg: "The institutional channel resonates with me. How are you thinking about content? Is it your own or user-generated?" },
    { from: 'ent', msg: "We\'re a platform, not a content company. Instructors and institutions publish their own content and we provide the adaptive delivery engine. This means we scale content without scaling headcount. We take 30% revenue share on paid courses sold through our marketplace." },
  ]},
  { inv: 'amara.diallo@bizmatch.app',  ent: 'sam.torres@bizmatch.app',     chat: [
    { from: 'inv', msg: "Sam, last-mile delivery with zero emissions and already processing 12,000 deliveries is a strong start. What\'s the carbon offset story and how do you monetise it?" },
    { from: 'ent', msg: "Each delivery generates a verified carbon certificate that we sell to brands who want to offset their e-commerce footprint. We charge brands $0.40 per delivery on top of the base delivery fee. This carbon revenue already covers 30% of our operating costs. We\'re working toward verified carbon credits through Gold Standard." },
    { from: 'inv', msg: "The carbon monetisation layer is what makes this differentiated. What does the retailer pipeline look like and what\'s blocking the next two signed contracts?" },
    { from: 'ent', msg: "We\'re in final negotiations with a regional grocery chain (18 stores, ~3,000 deliveries/week) and a D2C fashion brand doing same-day in Paris. Both deals are blocked on proof of scale — they want to see 5,000 deliveries/week before committing. The $200k gets us the e-bikes to hit that number." },
  ]},
];

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function wipeDatabase(conn) {
  console.log('\nDropping all tables...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of DROP_ORDER) {
    await conn.query(`DROP TABLE IF EXISTS ${t}`);
    console.log(`  dropped ${t}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function runMigrations(conn) {
  console.log('\nRunning migrations...');
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log(`  ✓ ${file}`);
  }
}

async function createUser(conn, { name, email, role }) {
  const [rows] = await conn.query('INSERT INTO users (name, email, password_hash, role, is_verified) VALUES (?, ?, ?, ?, 1)', [name, email, PASSWORD_HASH, role]);
  return rows.insertId;
}

async function createInvestorProfile(conn, userId, inv) {
  await conn.query(
    `INSERT INTO profiles (user_id, bio, role_type, investment_domain, preferred_stage, max_investment, skills)
     VALUES (?, ?, 'investor', ?, ?, ?, ?)`,
    [userId, inv.bio, inv.domain, inv.stage, inv.max, JSON.stringify(['Due Diligence', 'Financial Modeling', 'Board Advisory'])]
  );
}

async function createEntrepreneurProfile(conn, userId, ent) {
  await conn.query(
    `INSERT INTO profiles (user_id, bio, role_type, venture_stage, funding_needs, skills, hobbies)
     VALUES (?, ?, 'entrepreneur', ?, ?, ?, ?)`,
    [userId, ent.bio, ent.stage, ent.needs, JSON.stringify(ent.skills), JSON.stringify(ent.hobbies)]
  );
}

async function createProject(conn, userId, ent) {
  await conn.query(
    `INSERT INTO projects (user_id, title, description, industry, stage, funding_needed, visibility)
     VALUES (?, ?, ?, ?, ?, ?, 'public')`,
    [userId, ent.title, ent.bio, ent.industry, ent.stage, ent.needs]
  );
}

async function createMatch(conn, invId, entId) {
  const [u1, u2] = invId < entId ? [invId, entId] : [entId, invId];
  await conn.query('INSERT IGNORE INTO swipes (swiper_id, swiped_id, direction) VALUES (?, ?, ?)', [invId, entId, 'like']);
  await conn.query('INSERT IGNORE INTO swipes (swiper_id, swiped_id, direction) VALUES (?, ?, ?)', [entId, invId, 'like']);
  await conn.query('INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)', [u1, u2]);
  const [[match]] = await conn.query('SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?', [u1, u2]);
  return match.id;
}

async function seedChat(conn, matchId, invId, entId, messages) {
  for (const m of messages) {
    const senderId = m.from === 'inv' ? invId : entId;
    await conn.query(
      'INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)',
      [matchId, senderId, m.msg]
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log('Connected to Railway MySQL.');

  await wipeDatabase(conn);

  console.log('\nAll tables dropped.');
  const answer = await confirm('Rebuild schema and seed data? Type "yes" to continue: ');
  if (answer !== 'yes') {
    console.log('Aborted. Tables have been dropped but not rebuilt.');
    await conn.end();
    process.exit(0);
  }

  await runMigrations(conn);

  // --- Investors ---
  console.log('\nCreating 25 investors...');
  const invMap = {};
  for (const inv of INVESTORS) {
    const id = await createUser(conn, { name: inv.name, email: inv.email, role: 'investor' });
    await createInvestorProfile(conn, id, inv);
    invMap[inv.email] = id;
    console.log(`  ✓ ${inv.name}`);
  }

  // --- Entrepreneurs ---
  console.log('\nCreating 25 entrepreneurs + projects...');
  const entMap = {};
  for (const ent of ENTREPRENEURS) {
    const id = await createUser(conn, { name: ent.name, email: ent.email, role: 'entrepreneur' });
    await createEntrepreneurProfile(conn, id, ent);
    await createProject(conn, id, ent);
    entMap[ent.email] = id;
    console.log(`  ✓ ${ent.name} — project: ${ent.title}`);
  }

  // --- Pre-made matches + chats ---
  console.log('\nCreating 6 pre-made matches with chat histories...');
  for (const pair of MATCH_PAIRS) {
    const invId = invMap[pair.inv];
    const entId = entMap[pair.ent];
    if (!invId || !entId) { console.log(`  skip (user not found): ${pair.inv} / ${pair.ent}`); continue; }
    const matchId = await createMatch(conn, invId, entId);
    await seedChat(conn, matchId, invId, entId, pair.chat);
    console.log(`  ✓ match: ${pair.inv.split('@')[0]} ↔ ${pair.ent.split('@')[0]} (${pair.chat.length} messages)`);
  }

  await conn.end();

  console.log('\n========================================');
  console.log('  Database rebuilt successfully!');
  console.log('  All accounts: password = Demo1234!');
  console.log('');
  console.log('  Sample investor logins:');
  console.log('    sarah.chen@bizmatch.app');
  console.log('    marcus.webb@bizmatch.app');
  console.log('    lena.fischer@bizmatch.app');
  console.log('');
  console.log('  Sample entrepreneur logins:');
  console.log('    alex.rivera@bizmatch.app');
  console.log('    mia.johnson@bizmatch.app');
  console.log('    jordan.lee@bizmatch.app');
  console.log('========================================\n');
}

async function confirm(question) {
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => readline.question(question, ans => { readline.close(); resolve(ans.trim()); }));
}

async function main() {
  console.log('\n⚠️  WARNING: This will DROP all 14 tables. All existing data will be permanently deleted.\n');
  const answer = await confirm('Type "yes" to drop all tables: ');
  if (answer !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }
  await run();
}

main().catch(err => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
