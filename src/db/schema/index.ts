import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

const ts = sql`CURRENT_TIMESTAMP::text`;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "staff", "artist"] }).notNull(),
  createdAt: text("created_at").notNull().default(ts),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  billingAddress: text("billing_address"),
  shippingAddress: text("shipping_address"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(ts),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const customerFiles = pgTable("customer_files", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  blobUrl: text("blob_url").notNull(),
  mimeType: text("mime_type"),
  createdAt: text("created_at").notNull().default(ts),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  source: text("source", {
    enum: ["website", "email", "whatsapp", "instagram", "manual", "chatbot"],
  }).notNull(),
  status: text("status").notNull().default("new"),
  title: text("title"),
  description: text("description"),
  rawPayload: text("raw_payload"),
  missingFields: text("missing_fields"),
  createdAt: text("created_at").notNull().default(ts),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  leadId: integer("lead_id").references(() => leads.id),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  productId: integer("product_id"),
  quantity: integer("quantity").notNull().default(1),
  bottleFormat: text("bottle_format"),
  theme: text("theme"),
  deadline: text("deadline"),
  status: text("status").notNull().default("awaiting_customer_info"),
  artistUserId: integer("artist_user_id").references(() => users.id),
  inventoryLocationId: integer("inventory_location_id").references(
    () => inventoryLocations.id
  ),
  stockDeductedAt: text("stock_deducted_at"),
  fulfillment: text("fulfillment", { enum: ["pickup", "ship"] }),
  invoiceStatus: text("invoice_status").notNull().default("not_sent"),
  trackingNumber: text("tracking_number"),
  expectedReadyDate: text("expected_ready_date"),
  guidelineApprovedAt: text("guideline_approved_at"),
  createdAt: text("created_at").notNull().default(ts),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const workInstructions = pgTable("work_instructions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  theme: text("theme"),
  colorScheme: text("color_scheme"),
  textContent: text("text_content"),
  frontDesign: text("front_design"),
  backDesign: text("back_design"),
  style: text("style"),
  logosNotes: text("logos_notes"),
  visualElements: text("visual_elements"),
  attachmentsNotes: text("attachments_notes"),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const orderFiles = pgTable("order_files", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  blobUrl: text("blob_url").notNull(),
  kind: text("kind", { enum: ["mockup", "photo", "final", "other"] }).default(
    "other"
  ),
  uploadedBy: text("uploaded_by"),
  createdAt: text("created_at").notNull().default(ts),
});

export const artistOrderEvents = pgTable("artist_order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  eventType: text("event_type", {
    enum: ["viewed", "started", "ready_for_review", "question", "photo_upload"],
  }).notNull(),
  note: text("note"),
  blobUrl: text("blob_url"),
  createdAt: text("created_at").notNull().default(ts),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  format: text("format"),
  sku: text("sku"),
  type: text("type", {
    enum: [
      "standard_bottle",
      "magnum",
      "special",
      "gift_box",
      "shipping",
      "material",
    ],
  }).notNull(),
  purchasePriceExVat: text("purchase_price_ex_vat"),
  sellPriceExVat: text("sell_price_ex_vat"),
  sellPriceIncVat: text("sell_price_inc_vat"),
  createdAt: text("created_at").notNull().default(ts),
});

export const inventoryLocations = pgTable("inventory_locations", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  locationType: text("location_type", { enum: ["office", "artist"] }).notNull(),
  artistUserId: integer("artist_user_id").references(() => users.id),
  createdAt: text("created_at").notNull().default(ts),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  locationId: integer("location_id")
    .notNull()
    .references(() => inventoryLocations.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  minimum: integer("minimum").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const supplierOrders = pgTable("supplier_orders", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  supplierName: text("supplier_name"),
  orderReference: text("order_reference"),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  destinationLocationId: integer("destination_location_id")
    .notNull()
    .references(() => inventoryLocations.id),
  status: text("status").notNull().default("ordered"),
  trackingNumber: text("tracking_number"),
  expectedDeliveryDate: text("expected_delivery_date"),
  notes: text("notes"),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull().default(ts),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  locationId: integer("location_id").references(() => inventoryLocations.id),
  locationFromId: integer("location_from_id").references(() => inventoryLocations.id),
  locationToId: integer("location_to_id").references(() => inventoryLocations.id),
  orderId: integer("order_id").references(() => orders.id),
  supplierOrderId: integer("supplier_order_id").references(() => supplierOrders.id),
  movementType: text("movement_type", {
    enum: ["reserve", "release", "consume", "adjust", "transfer", "receive", "add"],
  }).notNull(),
  quantity: integer("quantity").notNull(),
  note: text("note"),
  userId: integer("user_id").references(() => users.id),
  createdAt: text("created_at").notNull().default(ts),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeUserId: integer("assignee_user_id").references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  leadId: integer("lead_id").references(() => leads.id),
  status: text("status", { enum: ["open", "done", "cancelled"] })
    .notNull()
    .default("open"),
  priority: text("priority", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  dueAt: text("due_at"),
  isAutomatic: boolean("is_automatic").notNull().default(false),
  createdAt: text("created_at").notNull().default(ts),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull().default("manual"),
  direction: text("direction", { enum: ["in", "out"] }).notNull().default("in"),
  subject: text("subject"),
  body: text("body").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  leadId: integer("lead_id").references(() => leads.id),
  orderId: integer("order_id").references(() => orders.id),
  classification: text("classification"),
  createdAt: text("created_at").notNull().default(ts),
});

export const messageDrafts = pgTable("message_drafts", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id),
  body: text("body").notNull(),
  approved: boolean("approved").notNull().default(false),
  createdAt: text("created_at").notNull().default(ts),
});

export const statusPageTokens = pgTable("status_page_tokens", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(ts),
});

export const kbArticles = pgTable("kb_articles", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  fromValue: text("from_value"),
  toValue: text("to_value"),
  userId: integer("user_id").references(() => users.id),
  createdAt: text("created_at").notNull().default(ts),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const aiAgentProfiles = pgTable("ai_agent_profiles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  systemPrompt: text("system_prompt"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull().default(ts),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const aiTrainingItems = pgTable("ai_training_items", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => aiAgentProfiles.id),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("manual"),
  createdAt: text("created_at").notNull().default(ts),
});

export const kbFiles = pgTable("kb_files", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => kbArticles.id),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type"),
  createdAt: text("created_at").notNull().default(ts),
});

export const aiTrainingFiles = pgTable("ai_training_files", {
  id: serial("id").primaryKey(),
  trainingItemId: integer("training_item_id").references(() => aiTrainingItems.id),
  agentId: integer("agent_id").references(() => aiAgentProfiles.id),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type"),
  createdAt: text("created_at").notNull().default(ts),
});

export const agentChatSessions = pgTable("agent_chat_sessions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => aiAgentProfiles.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["active", "completed"] })
    .notNull()
    .default("active"),
  collectedData: text("collected_data"),
  customerId: integer("customer_id").references(() => customers.id),
  leadId: integer("lead_id").references(() => leads.id),
  createdAt: text("created_at").notNull().default(ts),
  updatedAt: text("updated_at").notNull().default(ts),
});

export const agentChatMessages = pgTable("agent_chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => agentChatSessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  questionType: text("question_type", {
    enum: ["text", "yes_no", "choice"],
  }),
  options: text("options"),
  createdAt: text("created_at").notNull().default(ts),
});
