// Auto-generated from schema. Regenerate with: npm run types
// Or keep this file and update manually when schema changes.

export type OrderStatus =
  | 'new'
  | 'review'
  | 'confirmed'
  | 'assembling'
  | 'shipped'
  | 'received'
  | 'cancelled'
  | 'rejected'

export type DeliveryType = 'office' | 'pvz' | 'pickup' | 'courier'

export type MovementType =
  | 'income'
  | 'reserve'
  | 'unreserve'
  | 'write_off'
  | 'return'
  | 'adjustment'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new:        'Новый заказ',
  review:     'На проверке',
  confirmed:  'Подтвержден',
  assembling: 'Собирается',
  shipped:    'Отправлен',
  received:   'Получен',
  cancelled:  'Отменен',
  rejected:   'Отклонен',
}

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  office:  'В офис',
  pvz:     'ПВЗ / Филиал',
  pickup:  'Самовывоз',
  courier: 'Курьер',
}

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id:          string
          full_name:   string
          email:       string
          phone:       string | null
          department:  string | null
          position:    string | null
          city:        string | null
          office:      string | null
          is_admin:    boolean
          created_at:  string
        }
        Insert: {
          id?:         string
          full_name:   string
          email:       string
          phone?:      string | null
          department?: string | null
          position?:   string | null
          city?:       string | null
          office?:     string | null
          is_admin?:   boolean
        }
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      categories: {
        Row:    { id: string; name: string; sort: number }
        Insert: { id?: string; name: string; sort?: number }
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      products: {
        Row: {
          id:          string
          name:        string
          description: string | null
          material:    string | null
          category_id: string | null
          image_url:   string | null
          images:      string[]
          is_active:   boolean
          created_at:  string
          updated_at:  string
        }
        Insert: {
          id?:          string
          name:         string
          description?: string | null
          material?:    string | null
          category_id?: string | null
          image_url?:   string | null
          images?:      string[]
          is_active?:   boolean
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_variants: {
        Row: {
          id:           string
          product_id:   string
          size:         string | null
          color:        string | null
          sku:          string | null
          total_qty:    number
          reserved_qty: number
          is_active:    boolean
          created_at:   string
          updated_at:   string
        }
        Insert: {
          id?:           string
          product_id:    string
          size?:         string | null
          color?:        string | null
          sku?:          string | null
          total_qty?:    number
          reserved_qty?: number
          is_active?:    boolean
        }
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']>
      }
      product_limits: {
        Row: {
          id:             string
          product_id:     string
          limit_per_emp:  number
          period:         string
          department:     string | null
          created_at:     string
        }
        Insert: {
          id?:             string
          product_id:      string
          limit_per_emp?:  number
          period?:         string
          department?:     string | null
        }
        Update: Partial<Database['public']['Tables']['product_limits']['Insert']>
      }
      carts: {
        Row: {
          id:          string
          employee_id: string
          status:      string
          created_at:  string
          updated_at:  string
        }
        Insert: { id?: string; employee_id: string; status?: string }
        Update: Partial<Database['public']['Tables']['carts']['Insert']>
      }
      cart_items: {
        Row: {
          id:         string
          cart_id:    string
          product_id: string
          variant_id: string
          qty:        number
          created_at: string
        }
        Insert: {
          id?:        string
          cart_id:    string
          product_id: string
          variant_id: string
          qty?:       number
        }
        Update: Partial<Database['public']['Tables']['cart_items']['Insert']>
      }
      orders: {
        Row: {
          id:               string
          order_number:     string
          employee_id:      string
          status:           OrderStatus
          delivery_type:    DeliveryType
          delivery_address: string | null
          full_name:        string | null
          phone:            string | null
          email:            string | null
          city:             string | null
          department:       string | null
          comment:          string | null
          admin_comment:    string | null
          tracking_number:  string | null
          assigned_to:      string | null
          created_at:       string
          confirmed_at:     string | null
          shipped_at:       string | null
          received_at:      string | null
          cancelled_at:     string | null
        }
        Insert: {
          id?:               string
          employee_id:       string
          status?:           OrderStatus
          delivery_type?:    DeliveryType
          delivery_address?: string | null
          full_name?:        string | null
          phone?:            string | null
          email?:            string | null
          city?:             string | null
          department?:       string | null
          comment?:          string | null
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']> & {
          status?:           OrderStatus
          admin_comment?:    string | null
          tracking_number?:  string | null
          assigned_to?:      string | null
          confirmed_at?:     string | null
          shipped_at?:       string | null
          received_at?:      string | null
          cancelled_at?:     string | null
        }
      }
      order_items: {
        Row: {
          id:           string
          order_id:     string
          product_id:   string
          variant_id:   string
          product_name: string
          size:         string | null
          color:        string | null
          sku:          string | null
          qty:          number
          created_at:   string
        }
        Insert: {
          id?:           string
          order_id:      string
          product_id:    string
          variant_id:    string
          product_name:  string
          size?:         string | null
          color?:        string | null
          sku?:          string | null
          qty:           number
        }
        Update: never
      }
      stock_movements: {
        Row: {
          id:             string
          variant_id:     string
          movement_type:  MovementType
          qty:            number
          order_id:       string | null
          comment:        string | null
          created_by:     string | null
          created_at:     string
        }
        Insert: {
          id?:             string
          variant_id:      string
          movement_type:   MovementType
          qty:             number
          order_id?:       string | null
          comment?:        string | null
          created_by?:     string | null
        }
        Update: never
      }
    }
    Views: {
      product_variants_available: {
        Row: Database['public']['Tables']['product_variants']['Row'] & {
          available_qty: number
        }
      }
    }
    Enums: {
      order_status:  OrderStatus
      delivery_type: DeliveryType
      movement_type: MovementType
    }
  }
}

// Convenience row types
export type Employee       = Database['public']['Tables']['employees']['Row']
export type Product        = Database['public']['Tables']['products']['Row']
export type ProductVariant = Database['public']['Tables']['product_variants']['Row']
export type ProductVariantAvailable = Database['public']['Views']['product_variants_available']['Row']
export type Order          = Database['public']['Tables']['orders']['Row']
export type OrderItem      = Database['public']['Tables']['order_items']['Row']
export type CartItem       = Database['public']['Tables']['cart_items']['Row']
export type StockMovement  = Database['public']['Tables']['stock_movements']['Row']

// Useful joined types
export type ProductWithVariants = Product & {
  category:  { name: string } | null
  variants:  ProductVariantAvailable[]
}

export type OrderWithItems = Order & {
  employee:    Pick<Employee, 'full_name' | 'email' | 'department'>
  order_items: (OrderItem & { variant: Pick<ProductVariant, 'size' | 'color'> })[]
}
