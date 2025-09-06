export type MenuItem = {
	id: number;
	name: string;
	price: number;
	description?: string; // optional
	category: string;
	image_url: string;
	// optional fields for availability and options
	is_available?: boolean | null;
	options?: MenuOptionGroup[] | null;
};

export type MenuOption = {
  id: string;           // stable id for the option
  name: string;         // e.g., "Extra Cheese"
  price_delta?: number; // positive or negative adjustment
};

export type MenuOptionGroup = {
  id: string;            // stable id for the group
  name: string;          // e.g., "Toppings"
  required?: boolean;    // must choose at least one
  max_select?: number;   // max options selectable in this group
  options: MenuOption[]; // choices
};

export type OrderItem = {
	id: number;
	menu_item_id: number;
	quantity: number;
};

export type Order = {
	id: number;
	table_id: string;
	name?: string | null;
	order_items: OrderItem[];
	status: string;
	comment?: string | null;
	disc_amt?: number | null;
	disc_pct?: number | null;
	created_at: string;
};
