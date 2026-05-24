import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PRODUCTS = [
  {
    id: "prod_sexual_health_consult",
    name: "Sexual Health Consultation",
    description:
      "Speak directly with a licensed sexual health specialist. Fully confidential, science-backed advice tailored to your concerns.",
    price: "199",
    category: "Consultation",
    imageUrl: null,
  },
  {
    id: "prod_ed_treatment",
    name: "Erectile Dysfunction Program",
    description:
      "Personalised treatment plan for ED — evidence-based, discreet, and managed entirely online by certified MDs.",
    price: "499",
    category: "Treatment",
    imageUrl: null,
  },
  {
    id: "prod_sti_screening",
    name: "STI Screening Package",
    description:
      "Comprehensive at-home STI test kit with clinician review. Results in 48 hours, fully private.",
    price: "999",
    category: "Diagnostics",
    imageUrl: null,
  },
  {
    id: "prod_relationship_therapy",
    name: "Relationship & Intimacy Therapy",
    description:
      "One-on-one sessions with a certified sex therapist. Build confidence, communication, and intimacy with expert guidance.",
    price: "799",
    category: "Therapy",
    imageUrl: null,
  },
  {
    id: "prod_womens_health",
    name: "Women's Sexual Wellness",
    description:
      "Specialist consultations for female sexual health — hormonal concerns, pain, desire, and reproductive wellness.",
    price: "299",
    category: "Consultation",
    imageUrl: null,
  },
];

const WAREHOUSES = [
  {
    id: "wh_mumbai",
    name: "Allo Health Mumbai",
    city: "Mumbai",
    address: "Bandra West, Mumbai – 400050",
  },
  {
    id: "wh_delhi",
    name: "Allo Health Delhi",
    city: "Delhi",
    address: "Connaught Place, New Delhi – 110001",
  },
  {
    id: "wh_bengaluru",
    name: "Allo Health Bengaluru",
    city: "Bengaluru",
    address: "Koramangala, Bengaluru – 560034",
  },
];

// Stock levels: [total, reserved]
const STOCK_LEVELS: Record<string, Record<string, [number, number]>> = {
  prod_sexual_health_consult: {
    wh_mumbai: [20, 3],
    wh_delhi: [15, 5],
    wh_bengaluru: [12, 2],
  },
  prod_ed_treatment: {
    wh_mumbai: [10, 0],
    wh_delhi: [8, 1],
    wh_bengaluru: [5, 0],
  },
  prod_sti_screening: {
    wh_mumbai: [30, 8],
    wh_delhi: [25, 10],
    wh_bengaluru: [20, 4],
  },
  prod_relationship_therapy: {
    wh_mumbai: [6, 2],
    wh_delhi: [4, 1],
    wh_bengaluru: [3, 0],
  },
  prod_womens_health: {
    wh_mumbai: [15, 1],
    wh_delhi: [2, 1], // Almost sold out — good for demo
    wh_bengaluru: [10, 3],
  },
};

async function main() {
  console.log("🌱 Seeding database...");

  // Upsert warehouses
  for (const wh of WAREHOUSES) {
    await prisma.warehouse.upsert({
      where: { id: wh.id },
      update: { name: wh.name, city: wh.city, address: wh.address },
      create: wh,
    });
  }
  console.log(`✓ ${WAREHOUSES.length} warehouses seeded`);

  // Upsert products
  for (const prod of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        description: prod.description,
        price: prod.price,
        category: prod.category,
      },
      create: prod,
    });
  }
  console.log(`✓ ${PRODUCTS.length} products seeded`);

  // Upsert stocks
  let stockCount = 0;
  for (const [productId, warehouses] of Object.entries(STOCK_LEVELS)) {
    for (const [warehouseId, [total, reserved]] of Object.entries(warehouses)) {
      await prisma.stock.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        update: { total, reserved },
        create: { productId, warehouseId, total, reserved },
      });
      stockCount++;
    }
  }
  console.log(`✓ ${stockCount} stock records seeded`);

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
