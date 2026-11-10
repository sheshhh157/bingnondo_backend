--
-- PostgreSQL database dump
--

\restrict PgdZ6teECf7XfW2jvCP7AJnZ3lQZrRgoO5H5cC3XtEBH6LwA23bepNgXIgEtUfl

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    actor_id integer,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id integer,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: business_hours; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_hours (
    id integer NOT NULL,
    day_of_week smallint NOT NULL,
    open_time time without time zone,
    close_time time without time zone,
    is_closed boolean DEFAULT false NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.business_hours OWNER TO postgres;

--
-- Name: business_hours_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_hours_id_seq OWNER TO postgres;

--
-- Name: business_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_hours_id_seq OWNED BY public.business_hours.id;


--
-- Name: chatbot_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chatbot_conversations (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chatbot_conversations OWNER TO postgres;

--
-- Name: chatbot_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chatbot_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chatbot_conversations_id_seq OWNER TO postgres;

--
-- Name: chatbot_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chatbot_conversations_id_seq OWNED BY public.chatbot_conversations.id;


--
-- Name: chatbot_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chatbot_messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    sender character varying(10) NOT NULL,
    content text NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chatbot_messages_sender_check CHECK (((sender)::text = ANY ((ARRAY['customer'::character varying, 'bot'::character varying])::text[])))
);


ALTER TABLE public.chatbot_messages OWNER TO postgres;

--
-- Name: chatbot_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chatbot_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chatbot_messages_id_seq OWNER TO postgres;

--
-- Name: chatbot_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chatbot_messages_id_seq OWNED BY public.chatbot_messages.id;


--
-- Name: customer_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_notifications (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    related_order_id integer,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.customer_notifications OWNER TO postgres;

--
-- Name: customer_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_notifications_id_seq OWNER TO postgres;

--
-- Name: customer_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_notifications_id_seq OWNED BY public.customer_notifications.id;


--
-- Name: customer_order_violations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_order_violations (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    order_id integer NOT NULL,
    violation_type character varying(30) NOT NULL,
    flagged_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_order_violations_violation_type_check CHECK (((violation_type)::text = ANY ((ARRAY['cancelled_before_prep'::character varying, 'cancelled_after_prep'::character varying, 'no_show'::character varying])::text[])))
);


ALTER TABLE public.customer_order_violations OWNER TO postgres;

--
-- Name: customer_order_violations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_order_violations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_order_violations_id_seq OWNER TO postgres;

--
-- Name: customer_order_violations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_order_violations_id_seq OWNED BY public.customer_order_violations.id;


--
-- Name: customer_restrictions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_restrictions (
    customer_id integer NOT NULL,
    restriction_level character varying(20) DEFAULT 'none'::character varying NOT NULL,
    reason text,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_restrictions_restriction_level_check CHECK (((restriction_level)::text = ANY ((ARRAY['none'::character varying, 'warned'::character varying, 'cod_restricted'::character varying, 'suspended'::character varying])::text[])))
);


ALTER TABLE public.customer_restrictions OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    email character varying(255),
    password_hash character varying(255) NOT NULL,
    email_verified boolean DEFAULT false,
    first_name character varying(50),
    last_name character varying(50),
    mobile_number character varying(11),
    mobile_verified boolean DEFAULT false,
    address text,
    profile_completed boolean DEFAULT false,
    status character varying(30) DEFAULT 'awaiting_verification'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    latitude numeric(10,7),
    longitude numeric(10,7),
    CONSTRAINT customers_has_contact CHECK (((email IS NOT NULL) OR (mobile_number IS NOT NULL))),
    CONSTRAINT customers_status_check CHECK (((status)::text = ANY ((ARRAY['awaiting_verification'::character varying, 'active'::character varying, 'suspended'::character varying])::text[])))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: dashboard_switch_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dashboard_switch_config (
    id integer NOT NULL,
    scope character varying(20) NOT NULL,
    staff_id integer,
    target_dashboard character varying(20),
    requires_pin boolean DEFAULT false NOT NULL,
    configured_by integer NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_scope_fields CHECK (((((scope)::text = 'per_staff'::text) AND (staff_id IS NOT NULL) AND (target_dashboard IS NULL)) OR (((scope)::text = 'per_dashboard'::text) AND (target_dashboard IS NOT NULL) AND (staff_id IS NULL)))),
    CONSTRAINT dashboard_switch_config_scope_check CHECK (((scope)::text = ANY ((ARRAY['per_staff'::character varying, 'per_dashboard'::character varying])::text[]))),
    CONSTRAINT dashboard_switch_config_target_dashboard_check CHECK (((target_dashboard)::text = ANY ((ARRAY['cashier'::character varying, 'kitchen_staff'::character varying, 'staff'::character varying, 'owner'::character varying])::text[])))
);


ALTER TABLE public.dashboard_switch_config OWNER TO postgres;

--
-- Name: TABLE dashboard_switch_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dashboard_switch_config IS 'Controls whether PIN verification is required on switch — scoped per staff member or per target dashboard.';


--
-- Name: dashboard_switch_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dashboard_switch_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dashboard_switch_config_id_seq OWNER TO postgres;

--
-- Name: dashboard_switch_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dashboard_switch_config_id_seq OWNED BY public.dashboard_switch_config.id;


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deliveries (
    id integer NOT NULL,
    order_id integer NOT NULL,
    delivery_preference character varying(20) NOT NULL,
    assigned_by integer,
    rider_name character varying(100),
    rider_contact character varying(20),
    lalamove_booking_id character varying(100),
    status character varying(20) DEFAULT 'pending_assignment'::character varying,
    assigned_at timestamp without time zone,
    delivered_at timestamp without time zone,
    rider_id integer,
    batch_id integer,
    stop_sequence smallint,
    CONSTRAINT deliveries_delivery_preference_check CHECK (((delivery_preference)::text = ANY ((ARRAY['own_delivery'::character varying, 'lalamove'::character varying])::text[]))),
    CONSTRAINT deliveries_status_check CHECK (((status)::text = ANY ((ARRAY['pending_assignment'::character varying, 'assigned'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.deliveries OWNER TO postgres;

--
-- Name: deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deliveries_id_seq OWNER TO postgres;

--
-- Name: deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deliveries_id_seq OWNED BY public.deliveries.id;


--
-- Name: delivery_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_batches (
    id integer NOT NULL,
    rider_id integer NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    batch_started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dispatched_at timestamp without time zone,
    completed_at timestamp without time zone,
    CONSTRAINT delivery_batches_status_check CHECK (((status)::text = ANY ((ARRAY['waiting'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.delivery_batches OWNER TO postgres;

--
-- Name: delivery_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_batches_id_seq OWNER TO postgres;

--
-- Name: delivery_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_batches_id_seq OWNED BY public.delivery_batches.id;


--
-- Name: esp32_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.esp32_devices (
    id integer NOT NULL,
    device_code text NOT NULL,
    location_label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'offline'::text NOT NULL,
    last_ping_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.esp32_devices OWNER TO postgres;

--
-- Name: esp32_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.esp32_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.esp32_devices_id_seq OWNER TO postgres;

--
-- Name: esp32_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.esp32_devices_id_seq OWNED BY public.esp32_devices.id;


--
-- Name: esp32_wifi_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.esp32_wifi_configs (
    device_id integer NOT NULL,
    ssid text NOT NULL,
    password_ciphertext text NOT NULL,
    server_url text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_version integer DEFAULT 0 NOT NULL,
    applied_at timestamp with time zone,
    last_error text
);


ALTER TABLE public.esp32_wifi_configs OWNER TO postgres;

--
-- Name: inventory_item_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_item_categories (
    inventory_item_id integer NOT NULL,
    category_id integer NOT NULL
);


ALTER TABLE public.inventory_item_categories OWNER TO postgres;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    unit character varying(20) NOT NULL,
    current_stock numeric(10,2) DEFAULT 0 NOT NULL,
    reorder_level numeric(10,2) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_items OWNER TO postgres;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_items_id_seq OWNER TO postgres;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_transactions (
    id integer NOT NULL,
    inventory_item_id integer NOT NULL,
    change_type character varying(20) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    reference_order_id integer,
    performed_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inventory_transactions_change_type_check CHECK (((change_type)::text = ANY ((ARRAY['restock'::character varying, 'deduction'::character varying, 'adjustment'::character varying])::text[])))
);


ALTER TABLE public.inventory_transactions OWNER TO postgres;

--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_transactions_id_seq OWNER TO postgres;

--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_transactions_id_seq OWNED BY public.inventory_transactions.id;


--
-- Name: kitchen_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kitchen_alerts (
    id integer NOT NULL,
    order_id integer NOT NULL,
    device_id integer,
    triggered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at timestamp without time zone,
    acknowledged_by integer
);


ALTER TABLE public.kitchen_alerts OWNER TO postgres;

--
-- Name: kitchen_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kitchen_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kitchen_alerts_id_seq OWNER TO postgres;

--
-- Name: kitchen_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kitchen_alerts_id_seq OWNED BY public.kitchen_alerts.id;


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL
);


ALTER TABLE public.menu_categories OWNER TO postgres;

--
-- Name: menu_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_categories_id_seq OWNER TO postgres;

--
-- Name: menu_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_categories_id_seq OWNED BY public.menu_categories.id;


--
-- Name: menu_category_variant_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_category_variant_groups (
    category_id integer NOT NULL,
    variant_group_id integer NOT NULL
);


ALTER TABLE public.menu_category_variant_groups OWNER TO postgres;

--
-- Name: menu_item_ingredients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_item_ingredients (
    menu_item_id integer NOT NULL,
    inventory_item_id integer NOT NULL,
    quantity_required numeric(10,2),
    unit character varying(20),
    conversion_factor numeric(14,6)
);


ALTER TABLE public.menu_item_ingredients OWNER TO postgres;

--
-- Name: COLUMN menu_item_ingredients.unit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.menu_item_ingredients.unit IS 'Unit the recipe amount is expressed in (e.g. ml). NULL = same as the inventory item stock unit.';


--
-- Name: COLUMN menu_item_ingredients.conversion_factor; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.menu_item_ingredients.conversion_factor IS 'Multiplier converting the recipe unit into the inventory stock unit (e.g. 1 ml = 0.001 liter). NULL = 1 (same unit).';


--
-- Name: menu_item_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_item_reviews (
    id integer NOT NULL,
    menu_item_id integer NOT NULL,
    customer_id integer,
    author_name character varying(100) NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT menu_item_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.menu_item_reviews OWNER TO postgres;

--
-- Name: menu_item_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_item_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_item_reviews_id_seq OWNER TO postgres;

--
-- Name: menu_item_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_item_reviews_id_seq OWNED BY public.menu_item_reviews.id;


--
-- Name: menu_item_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_item_variants (
    id integer NOT NULL,
    menu_item_id integer NOT NULL,
    name character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    variant_group_id integer
);


ALTER TABLE public.menu_item_variants OWNER TO postgres;

--
-- Name: menu_item_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_item_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_item_variants_id_seq OWNER TO postgres;

--
-- Name: menu_item_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_item_variants_id_seq OWNED BY public.menu_item_variants.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    category_id integer NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url character varying(500),
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp without time zone,
    display_order smallint DEFAULT 0 NOT NULL,
    image_public_id character varying(255) DEFAULT NULL::character varying
);


ALTER TABLE public.menu_items OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_items_id_seq OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    staff_id integer,
    target_role character varying(20),
    type character varying(50) NOT NULL,
    reference_id integer,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    customer_id integer,
    message text
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    notes character varying(255),
    variant_id integer,
    variant_name character varying(100),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    status character varying(20) NOT NULL,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.order_status_history OWNER TO postgres;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_status_history_id_seq OWNER TO postgres;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_type character varying(10) NOT NULL,
    customer_id integer,
    cashier_id integer,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    order_channel character varying(20) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    special_request text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    order_number character varying(30),
    delivery_address text,
    delivery_latitude numeric(10,7),
    delivery_longitude numeric(10,7),
    delivery_fee numeric(10,2) DEFAULT 0,
    CONSTRAINT orders_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['online'::character varying, 'counter'::character varying])::text[]))),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'preparing'::character varying, 'ready'::character varying, 'out_for_delivery'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_verifications (
    id integer NOT NULL,
    contact character varying(255) NOT NULL,
    otp_code character varying(6) NOT NULL,
    purpose character varying(30) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    consumed_at timestamp without time zone,
    CONSTRAINT otp_verifications_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['email_verification'::character varying, 'mobile_verification'::character varying, 'password_reset'::character varying])::text[])))
);


ALTER TABLE public.otp_verifications OWNER TO postgres;

--
-- Name: otp_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.otp_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_verifications_id_seq OWNER TO postgres;

--
-- Name: otp_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.otp_verifications_id_seq OWNED BY public.otp_verifications.id;


--
-- Name: payment_qr_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_qr_codes (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    number character varying(50) NOT NULL,
    image_url text NOT NULL,
    image_public_id character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.payment_qr_codes OWNER TO postgres;

--
-- Name: TABLE payment_qr_codes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payment_qr_codes IS 'Admin-managed e-wallet QR codes (GCash, Maya, etc.) shown to customers at checkout.';


--
-- Name: payment_qr_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_qr_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_qr_codes_id_seq OWNER TO postgres;

--
-- Name: payment_qr_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_qr_codes_id_seq OWNED BY public.payment_qr_codes.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    order_id integer NOT NULL,
    method character varying(20) NOT NULL,
    amount numeric(10,2) NOT NULL,
    paymongo_payment_id character varying(150),
    status character varying(30) DEFAULT 'pending'::character varying,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    gcash_ref_number character varying(100) DEFAULT NULL::character varying,
    receipt_image_url character varying(500) DEFAULT NULL::character varying,
    receipt_uploaded_at timestamp without time zone,
    verified_by integer,
    verified_at timestamp without time zone,
    rejection_reason character varying(255) DEFAULT NULL::character varying,
    gcash_amount_sent numeric(10,2) DEFAULT NULL::numeric,
    rejected_at timestamp without time zone,
    resubmitted_at timestamp without time zone,
    rejection_count integer DEFAULT 0,
    previous_receipt_image_url text,
    previous_rejection_reason character varying(255) DEFAULT NULL::character varying,
    CONSTRAINT payments_method_check CHECK (((method)::text = ANY ((ARRAY['gcash'::character varying, 'cash'::character varying, 'cash_on_delivery'::character varying])::text[]))),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'awaiting_verification'::character varying, 'paid'::character varying, 'rejected'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: COLUMN payments.gcash_amount_sent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.gcash_amount_sent IS 'Amount extracted from the customer''s GCash receipt screenshot via OCR. NULL means OCR could not read it — staff must verify manually. Compare against `amount` to detect short payments.';


--
-- Name: COLUMN payments.resubmitted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.resubmitted_at IS 'Timestamp of the most recent customer re-upload after a rejection. NULL means never re-submitted.';


--
-- Name: COLUMN payments.rejection_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.rejection_count IS 'How many times this payment has been rejected so far. Incremented when staff rejects. Helps cashier know if this is a repeat offender.';


--
-- Name: COLUMN payments.previous_receipt_image_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.previous_receipt_image_url IS 'The receipt URL that was rejected. Saved when customer re-uploads so cashier can compare the original rejected receipt vs the new one side by side.';


--
-- Name: COLUMN payments.previous_rejection_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.previous_rejection_reason IS 'Why the receipt was rejected. Copied from rejection_reason when staff rejects a receipt, and kept after the customer re-uploads (the re-upload clears rejection_reason). NULL means the receipt was never rejected.';


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: pending_registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_registrations (
    email character varying(255),
    password_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    mobile_number character varying(20),
    id integer NOT NULL
);


ALTER TABLE public.pending_registrations OWNER TO postgres;

--
-- Name: pending_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pending_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pending_registrations_id_seq OWNER TO postgres;

--
-- Name: pending_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pending_registrations_id_seq OWNED BY public.pending_registrations.id;


--
-- Name: rider_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rider_locations (
    rider_id integer NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    accuracy real,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.rider_locations OWNER TO postgres;

--
-- Name: riders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.riders (
    id integer NOT NULL,
    mobile_number character varying(20) NOT NULL,
    plate_number character varying(30),
    vehicle_type character varying(50),
    notes text,
    status character varying(20) DEFAULT 'available'::character varying NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(150),
    password_hash text,
    last_login timestamp without time zone,
    first_name character varying(100) NOT NULL,
    middle_name character varying(100),
    last_name character varying(100) NOT NULL,
    full_name character varying(300) GENERATED ALWAYS AS ((((TRIM(BOTH FROM first_name) || ' '::text) || COALESCE((TRIM(BOTH FROM middle_name) || ' '::text), ''::text)) || TRIM(BOTH FROM last_name))) STORED,
    work_status character varying(10) DEFAULT NULL::character varying,
    work_status_set_at timestamp without time zone,
    admin_work_override character varying(10) DEFAULT NULL::character varying,
    admin_work_override_at timestamp without time zone,
    profile_image_url text,
    profile_image_public_id text,
    CONSTRAINT riders_admin_work_override_check CHECK (((admin_work_override IS NULL) OR ((admin_work_override)::text = ANY ((ARRAY['working'::character varying, 'off'::character varying])::text[])))),
    CONSTRAINT riders_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'on_delivery'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT riders_work_status_check CHECK (((work_status IS NULL) OR ((work_status)::text = ANY ((ARRAY['working'::character varying, 'off'::character varying])::text[]))))
);


ALTER TABLE public.riders OWNER TO postgres;

--
-- Name: riders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.riders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.riders_id_seq OWNER TO postgres;

--
-- Name: riders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.riders_id_seq OWNED BY public.riders.id;


--
-- Name: staff_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_accounts (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notification_seen_at timestamp without time zone,
    first_name character varying(100) NOT NULL,
    middle_name character varying(100),
    last_name character varying(100) NOT NULL,
    full_name character varying(300) GENERATED ALWAYS AS ((((TRIM(BOTH FROM first_name) || ' '::text) || COALESCE((TRIM(BOTH FROM middle_name) || ' '::text), ''::text)) || TRIM(BOTH FROM last_name))) STORED,
    profile_image_url text,
    profile_image_public_id text,
    CONSTRAINT staff_accounts_role_check CHECK (((role)::text = ANY ((ARRAY['cashier'::character varying, 'kitchen_staff'::character varying, 'staff'::character varying, 'owner'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT staff_accounts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'deactivated'::character varying])::text[])))
);


ALTER TABLE public.staff_accounts OWNER TO postgres;

--
-- Name: staff_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_accounts_id_seq OWNER TO postgres;

--
-- Name: staff_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_accounts_id_seq OWNED BY public.staff_accounts.id;


--
-- Name: staff_dashboard_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_dashboard_access (
    id integer NOT NULL,
    staff_id integer NOT NULL,
    target_dashboard character varying(20) NOT NULL,
    granted_by integer NOT NULL,
    granted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT staff_dashboard_access_target_dashboard_check CHECK (((target_dashboard)::text = ANY ((ARRAY['cashier'::character varying, 'kitchen_staff'::character varying, 'staff'::character varying, 'owner'::character varying])::text[])))
);


ALTER TABLE public.staff_dashboard_access OWNER TO postgres;

--
-- Name: TABLE staff_dashboard_access; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.staff_dashboard_access IS 'Admin-granted permission for a staff member to switch into a dashboard without logging out.';


--
-- Name: staff_dashboard_access_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_dashboard_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_dashboard_access_id_seq OWNER TO postgres;

--
-- Name: staff_dashboard_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_dashboard_access_id_seq OWNED BY public.staff_dashboard_access.id;


--
-- Name: staff_switch_pin; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_switch_pin (
    staff_id integer NOT NULL,
    pin_hash character varying(255) NOT NULL,
    set_by_admin boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.staff_switch_pin OWNER TO postgres;

--
-- Name: TABLE staff_switch_pin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.staff_switch_pin IS 'Bcrypt-hashed PIN used to authenticate a dashboard switch. Set by Admin; changeable by staff.';


--
-- Name: support_chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_chat_messages (
    id integer NOT NULL,
    chat_id integer NOT NULL,
    sender_type character varying(10) NOT NULL,
    sender_id integer NOT NULL,
    related_order_id integer,
    content text NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_read boolean DEFAULT false,
    CONSTRAINT support_chat_messages_sender_type_check CHECK (((sender_type)::text = ANY ((ARRAY['customer'::character varying, 'staff'::character varying])::text[])))
);


ALTER TABLE public.support_chat_messages OWNER TO postgres;

--
-- Name: support_chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.support_chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_chat_messages_id_seq OWNER TO postgres;

--
-- Name: support_chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.support_chat_messages_id_seq OWNED BY public.support_chat_messages.id;


--
-- Name: support_chats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_chats (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    status character varying(10) DEFAULT 'locked'::character varying,
    opened_at timestamp without time zone,
    locked_at timestamp without time zone,
    CONSTRAINT support_chats_status_check CHECK (((status)::text = ANY ((ARRAY['unlocked'::character varying, 'locked'::character varying])::text[])))
);


ALTER TABLE public.support_chats OWNER TO postgres;

--
-- Name: support_chats_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.support_chats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_chats_id_seq OWNER TO postgres;

--
-- Name: support_chats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.support_chats_id_seq OWNED BY public.support_chats.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    key character varying(100) NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: variant_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.variant_groups (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    max_options integer DEFAULT 3 NOT NULL,
    CONSTRAINT chk_variant_groups_max_options CHECK (((max_options >= 1) AND (max_options <= 10)))
);


ALTER TABLE public.variant_groups OWNER TO postgres;

--
-- Name: variant_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.variant_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.variant_groups_id_seq OWNER TO postgres;

--
-- Name: variant_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.variant_groups_id_seq OWNED BY public.variant_groups.id;


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: business_hours id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours ALTER COLUMN id SET DEFAULT nextval('public.business_hours_id_seq'::regclass);


--
-- Name: chatbot_conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_conversations ALTER COLUMN id SET DEFAULT nextval('public.chatbot_conversations_id_seq'::regclass);


--
-- Name: chatbot_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_messages ALTER COLUMN id SET DEFAULT nextval('public.chatbot_messages_id_seq'::regclass);


--
-- Name: customer_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_notifications ALTER COLUMN id SET DEFAULT nextval('public.customer_notifications_id_seq'::regclass);


--
-- Name: customer_order_violations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_order_violations ALTER COLUMN id SET DEFAULT nextval('public.customer_order_violations_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: dashboard_switch_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_switch_config ALTER COLUMN id SET DEFAULT nextval('public.dashboard_switch_config_id_seq'::regclass);


--
-- Name: deliveries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries ALTER COLUMN id SET DEFAULT nextval('public.deliveries_id_seq'::regclass);


--
-- Name: delivery_batches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_batches ALTER COLUMN id SET DEFAULT nextval('public.delivery_batches_id_seq'::regclass);


--
-- Name: esp32_devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esp32_devices ALTER COLUMN id SET DEFAULT nextval('public.esp32_devices_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: inventory_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions ALTER COLUMN id SET DEFAULT nextval('public.inventory_transactions_id_seq'::regclass);


--
-- Name: kitchen_alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_alerts ALTER COLUMN id SET DEFAULT nextval('public.kitchen_alerts_id_seq'::regclass);


--
-- Name: menu_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_categories_id_seq'::regclass);


--
-- Name: menu_item_reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_reviews ALTER COLUMN id SET DEFAULT nextval('public.menu_item_reviews_id_seq'::regclass);


--
-- Name: menu_item_variants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variants ALTER COLUMN id SET DEFAULT nextval('public.menu_item_variants_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: otp_verifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_verifications ALTER COLUMN id SET DEFAULT nextval('public.otp_verifications_id_seq'::regclass);


--
-- Name: payment_qr_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_qr_codes ALTER COLUMN id SET DEFAULT nextval('public.payment_qr_codes_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: pending_registrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_registrations ALTER COLUMN id SET DEFAULT nextval('public.pending_registrations_id_seq'::regclass);


--
-- Name: riders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riders ALTER COLUMN id SET DEFAULT nextval('public.riders_id_seq'::regclass);


--
-- Name: staff_accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_accounts ALTER COLUMN id SET DEFAULT nextval('public.staff_accounts_id_seq'::regclass);


--
-- Name: staff_dashboard_access id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_dashboard_access ALTER COLUMN id SET DEFAULT nextval('public.staff_dashboard_access_id_seq'::regclass);


--
-- Name: support_chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chat_messages ALTER COLUMN id SET DEFAULT nextval('public.support_chat_messages_id_seq'::regclass);


--
-- Name: support_chats id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chats ALTER COLUMN id SET DEFAULT nextval('public.support_chats_id_seq'::regclass);


--
-- Name: variant_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variant_groups ALTER COLUMN id SET DEFAULT nextval('public.variant_groups_id_seq'::regclass);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_log (id, actor_id, action, target_type, target_id, details, created_at) FROM stdin;
119	5	create_rider	rider	39	{"email": "juan@email.com", "full_name": "juan", "mobile_number": "09123456789"}	2026-10-20 16:43:45.764962
120	5	reset_staff_password	staff_accounts	12	{"target_email": "kitchen@bingnondo.com"}	2026-10-20 21:36:30.863269
121	5	create_variant_group	variant_groups	1	{"name": "Hot/Cold", "max_options": 3}	2026-11-02 12:21:19.341895
122	5	update_variant_group	variant_groups	1	{"new_name": "Hot/Cold", "old_name": "Hot/Cold", "max_options": 2}	2026-11-02 12:22:16.48616
123	5	update_category_variants	menu_categories	8	{"category": "Drinks (Non- Caffeinated)", "group_ids": [1], "removed_group_ids": []}	2026-11-02 12:22:38.187192
124	5	update_business_hours	business_hours	\N	{"days_updated": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}	2026-11-04 17:12:06.570206
167	5	create_payment_qr_code	payment_qr_codes	1	{"name": "GcaS ko", "number": "09123456789"}	2026-11-09 15:26:15.277296
168	5	update_payment_qr_code	payment_qr_codes	1	{"name": "GcaS ko", "number": "09123456789", "is_active": false, "display_order": 0, "image_changed": false}	2026-11-09 15:26:24.171385
169	5	update_payment_qr_code	payment_qr_codes	1	{"name": "GcaS ko", "number": "09123456789", "is_active": true, "display_order": 0, "image_changed": false}	2026-11-09 15:26:29.166797
170	5	update_delivery_fee	system_settings	\N	{"amount": 69, "enabled": true}	2026-11-09 17:09:01.21219
171	5	admin_work_override	rider	39	{"to": "off", "from": null, "rider_name": "juan juan"}	2026-11-09 19:42:09.367473
172	5	admin_work_override	rider	39	{"to": "working", "from": "off", "rider_name": "juan juan"}	2026-11-09 19:42:18.89869
173	5	admin_work_override	rider	39	{"to": "off", "from": "working", "rider_name": "juan juan"}	2026-11-09 19:42:21.39243
174	5	admin_work_override	rider	39	{"to": null, "from": "off", "rider_name": "juan juan"}	2026-11-09 19:42:28.356596
175	5	admin_work_override	rider	39	{"to": "off", "from": null, "rider_name": "juan juan"}	2026-11-09 19:42:30.003027
176	5	admin_work_override	rider	39	{"to": null, "from": "off", "rider_name": "juan juan"}	2026-11-09 19:42:30.644883
177	5	admin_work_override	rider	39	{"to": "working", "from": null, "rider_name": "juan juan"}	2026-11-09 19:42:33.545971
178	5	admin_work_override	rider	39	{"to": "off", "from": "working", "rider_name": "juan juan"}	2026-11-09 19:42:34.577124
179	5	update_rider_status	rider	39	{"to": "inactive", "from": "available", "rider_name": "juan juan"}	2026-11-09 19:44:26.456443
180	5	update_rider_status	rider	39	{"to": "available", "from": "inactive", "rider_name": "juan juan"}	2026-11-09 19:44:31.849357
181	5	admin_work_override	rider	39	{"to": "off", "from": "off", "rider_name": "juan juan"}	2026-11-09 19:47:47.923513
182	5	admin_work_override	rider	39	{"to": "working", "from": "off", "rider_name": "juan juan"}	2026-11-09 19:47:56.030855
183	5	admin_work_override	rider	39	{"to": "off", "from": "working", "rider_name": "juan juan"}	2026-11-09 19:47:58.299665
184	5	update_delivery_fee	system_settings	\N	{"amount": 69, "enabled": true}	2026-11-09 22:00:07.41802
185	5	update_business_hours	business_hours	\N	{"days_updated": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}	2026-11-09 22:26:46.569809
186	5	update_business_hours	business_hours	\N	{"days_updated": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}	2026-11-09 22:27:44.912104
187	5	update_business_hours	business_hours	\N	{"days_updated": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}	2026-11-10 00:23:26.884871
188	5	update_business_hours	business_hours	\N	{"days_updated": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}	2026-11-10 00:23:40.659903
189	5	admin_work_override	rider	39	{"to": "working", "from": "off", "rider_name": "juan juan"}	2026-11-10 11:28:09.510922
190	5	admin_work_override	rider	39	{"to": null, "from": "working", "rider_name": "juan juan"}	2026-11-10 11:28:11.476129
191	5	admin_work_override	rider	39	{"to": "working", "from": null, "rider_name": "juan juan"}	2026-11-10 11:28:12.191716
192	5	admin_work_override	rider	39	{"to": "off", "from": "working", "rider_name": "juan juan"}	2026-11-10 11:31:39.290258
\.


--
-- Data for Name: business_hours; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business_hours (id, day_of_week, open_time, close_time, is_closed, updated_by, updated_at) FROM stdin;
1	1	07:00:00	20:00:00	f	5	2026-11-10 00:23:40.659903
2	2	00:00:00	23:59:00	f	5	2026-11-10 00:23:40.659903
3	3	\N	\N	t	5	2026-11-10 00:23:40.659903
4	4	08:00:00	22:00:00	f	5	2026-11-10 00:23:40.659903
5	5	07:00:00	23:00:00	f	5	2026-11-10 00:23:40.659903
6	6	08:00:00	23:00:00	f	5	2026-11-10 00:23:40.659903
7	0	08:00:00	21:00:00	f	5	2026-11-10 00:23:40.659903
\.


--
-- Data for Name: chatbot_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chatbot_conversations (id, customer_id, started_at) FROM stdin;
1	20	2026-10-02 17:18:29.424135
2	20	2026-10-08 09:38:54.2569
3	20	2026-10-14 22:08:58.726564
4	20	2026-10-16 09:23:28.426474
\.


--
-- Data for Name: chatbot_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chatbot_messages (id, conversation_id, sender, content, sent_at) FROM stdin;
1	1	customer	hi	2026-10-02 17:41:15.302561
2	1	bot	Welcome to Bingnondo Cafe! I am Ndo, your friendly guide to our authentic Binondo-themed treats. How can I help you explore our menu or answer your questions about the cafe today?	2026-10-02 17:41:15.302561
3	1	customer	ano available ngayon ??	2026-10-02 17:41:44.698108
4	1	bot	Hello! Here is what we have available on our menu right now:\n\n• Mami for PHP 69.00\n• Tapsilog for PHP 120.00\n\nLet me know if you would like to know more about any of these items or if you need help deciding what to order!	2026-10-02 17:41:44.698108
5	1	customer	ano oras kayo nagbubukas??	2026-10-02 17:49:58.579745
6	1	bot	Hello! As for what is available right now, we have our delicious Mami for PHP 69.00 and our classic Tapsilog for PHP 120.00. \n\nRegarding our operating hours, I do not have our specific opening and closing times on hand, but I can certainly help you with our menu, payment methods, or delivery options. \n\nJust let me know if you would like to place an order for delivery using GCash or Cash on Delivery!	2026-10-02 17:49:58.579745
7	1	customer	anong meaning ng love??	2026-10-02 22:00:56.291188
8	1	bot	I do not have our specific opening and closing hours on hand, but I can tell you all about our delicious menu items like our Mami and Tapsilog. \n\nAs for the meaning of love, while that is a wonderful question, my expertise is strictly here at Bingnondo Cafe! I am happy to help you with anything related to our Binondo-themed treats, delivery options, or payment methods.	2026-10-02 22:00:56.291188
9	2	customer	who develop python	2026-10-08 09:38:57.914717
10	2	bot	Python was created by Guido van Rossum, and its first release was in 1991. \n\nWhile I love talking about technology and programming, my main specialty here at Bingnondo Cafe is helping you explore our authentic Chinatown-inspired menu and answering questions about our cafe. Would you like a recommendation for a warm drink to enjoy while you code?	2026-10-08 09:38:57.914717
11	3	customer	sino dev of python?	2026-10-14 22:09:00.401642
12	3	bot	I am Ndo, the assistant here at Bingnondo Cafe, and my expertise is strictly focused on our authentic Chinatown-themed menu, cafe details, and helping you place an order. Because Python development is outside my scope, I cannot answer that question. \n\nIf you would like a recommendation from our menu, such as our popular Sea Salt Latte or savory Xiao Long Bao, I would be happy to help you with that.	2026-10-14 22:09:00.401642
13	4	customer	who develop python	2026-10-16 09:23:30.578922
14	4	bot	Python was created by Guido van Rossum, and its first release was back in 1991. \n\nIf you have any questions about our Binondo-themed menu here at Bingnondo Cafe or need help deciding what to eat, feel free to ask!	2026-10-16 09:23:30.578922
\.


--
-- Data for Name: customer_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_notifications (id, customer_id, type, message, related_order_id, is_read, created_at) FROM stdin;
1	20	order_confirmed	Your order has been confirmed. We are on it!	130	f	2026-11-03 14:29:10.785424
2	20	order_confirmed	Your order has been confirmed. We are on it!	131	f	2026-11-03 15:08:57.687421
3	20	order_confirmed	Your order has been confirmed. We are on it!	132	f	2026-11-04 10:11:38.117049
4	20	payment_received	Your GCash payment was verified. Your order is confirmed and the kitchen is on it!	128	f	2026-11-04 10:11:49.621688
5	20	order_confirmed	Your order has been confirmed. We are on it!	133	f	2026-11-05 18:06:16.866787
54	20	order_cancelled	Your order has been cancelled.	221	f	2026-11-10 00:32:26.476621
55	20	order_confirmed	Your order has been confirmed. We are on it!	225	f	2026-11-10 11:56:53.029042
\.


--
-- Data for Name: customer_order_violations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_order_violations (id, customer_id, order_id, violation_type, flagged_by, created_at) FROM stdin;
\.


--
-- Data for Name: customer_restrictions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_restrictions (customer_id, restriction_level, reason, updated_by, updated_at) FROM stdin;
20	none	oky	5	2026-10-08 10:32:36.095809
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, email, password_hash, email_verified, first_name, last_name, mobile_number, mobile_verified, address, profile_completed, status, created_at, updated_at, latitude, longitude) FROM stdin;
20	carlnovero29@gmail.com	$2b$12$nn.JETH9HVcuQ7NTbhuNhe4a9FdqHfadyuJogzwcqHjkTHiL5ieLy	t	Carl Angelo	Novero	09817331308	t	Villa Josefina, Santa Cruz, Laguna, 4009, Philippines	t	active	2026-09-30 12:10:37.930605	2026-11-09 16:24:15.969546	14.2788196	121.4117173
134	\N	$2b$12$3/3lnSPEgCz7YJrvCNY3A.zbKkhTO/PxkJDkkg9WgqaUfWDQPHbNi	f	\N	\N	09709693223	t	\N	f	active	2026-11-09 20:03:42.49502	2026-11-09 20:03:42.49502	\N	\N
\.


--
-- Data for Name: dashboard_switch_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dashboard_switch_config (id, scope, staff_id, target_dashboard, requires_pin, configured_by, updated_at) FROM stdin;
\.


--
-- Data for Name: deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deliveries (id, order_id, delivery_preference, assigned_by, rider_name, rider_contact, lalamove_booking_id, status, assigned_at, delivered_at, rider_id, batch_id, stop_sequence) FROM stdin;
63	133	own_delivery	\N	juan	09123456789	\N	delivered	2026-11-05 18:06:32.510989	2026-11-09 19:35:45.786927	39	2	1
97	221	own_delivery	\N	\N	\N	\N	pending_assignment	\N	\N	\N	\N	\N
98	222	own_delivery	\N	\N	\N	\N	pending_assignment	\N	\N	\N	\N	\N
57	127	own_delivery	\N	\N	\N	\N	pending_assignment	\N	\N	\N	\N	\N
59	129	own_delivery	\N	juan	09123456789	\N	delivered	2026-10-20 21:37:37.038053	2026-10-20 21:39:40.532541	39	\N	\N
60	130	own_delivery	\N	juan	09123456789	\N	delivered	2026-11-03 14:29:24.330317	2026-11-03 15:09:35.970144	39	\N	\N
61	131	own_delivery	\N	juan	09123456789	\N	out_for_delivery	2026-11-03 15:09:35.970144	\N	39	\N	\N
62	132	own_delivery	\N	juan	09123456789	\N	delivered	2026-11-04 10:12:17.189783	2026-11-04 13:41:47.912304	39	1	1
58	128	own_delivery	\N	juan	09123456789	\N	delivered	2026-11-04 10:12:58.155632	2026-11-05 18:05:49.569946	39	1	2
\.


--
-- Data for Name: delivery_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_batches (id, rider_id, status, batch_started_at, dispatched_at, completed_at) FROM stdin;
1	39	completed	2026-11-04 10:12:17.189783	2026-11-04 10:32:17.416828	2026-11-05 18:05:49.569946
2	39	completed	2026-11-05 18:06:32.510989	2026-11-05 18:26:32.58134	2026-11-09 19:35:45.786927
\.


--
-- Data for Name: esp32_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.esp32_devices (id, device_code, location_label, created_at, status, last_ping_at) FROM stdin;
1	ESP32-KitchenA	Kitchen Counter A	2026-10-15 12:13:45.369529+08	online	2026-10-15 12:13:45.369529+08
\.


--
-- Data for Name: esp32_wifi_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.esp32_wifi_configs (device_id, ssid, password_ciphertext, server_url, version, updated_by, updated_at, applied_version, applied_at, last_error) FROM stdin;
\.


--
-- Data for Name: inventory_item_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_item_categories (inventory_item_id, category_id) FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_items (id, name, unit, current_stock, reorder_level, updated_at) FROM stdin;
5	__test_ing_1792085792792_0	g	500.00	100.00	2026-10-16 01:36:33.474644
13	__test_ing_1792103429941_0	g	500.00	100.00	2026-10-16 06:30:30.651626
21	xiao long bao	pcs	100.00	20.00	2026-10-16 08:12:17.342453
22	pork siomai	pcs	50.00	15.00	2026-10-16 08:13:20.63267
20	kape	gram	1000.00	50.00	2026-10-16 09:14:29.984512
23	lumpia	pcs	76.00	25.00	2026-11-04 10:12:56.924352
\.


--
-- Data for Name: inventory_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_transactions (id, inventory_item_id, change_type, quantity, reference_order_id, performed_by, created_at) FROM stdin;
16	23	deduction	4.00	129	12	2026-10-20 21:37:11.117643
17	23	deduction	4.00	131	12	2026-11-03 15:09:13.010173
18	23	deduction	4.00	132	12	2026-11-04 10:12:15.613103
19	23	deduction	4.00	128	12	2026-11-04 10:12:56.924352
\.


--
-- Data for Name: kitchen_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kitchen_alerts (id, order_id, device_id, triggered_at, acknowledged_at, acknowledged_by) FROM stdin;
12	128	1	2026-11-04 10:11:49.574839	\N	\N
\.


--
-- Data for Name: menu_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_categories (id, name, display_order) FROM stdin;
2	Rice Meals	0
5	Add-ons	0
6	Appetizers	0
7	Drinks (Caffeinated)	0
8	Drinks (Non- Caffeinated)	0
9	Rice Meals (Student)	0
10	Drinks (Student)	0
11	wala lang	0
\.


--
-- Data for Name: menu_category_variant_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_category_variant_groups (category_id, variant_group_id) FROM stdin;
8	1
\.


--
-- Data for Name: menu_item_ingredients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_item_ingredients (menu_item_id, inventory_item_id, quantity_required, unit, conversion_factor) FROM stdin;
88	5	250.00	\N	\N
102	13	250.00	\N	\N
8	22	4.00	\N	\N
3	23	4.00	\N	\N
9	20	0.17	\N	\N
4	21	5.00	\N	\N
\.


--
-- Data for Name: menu_item_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_item_reviews (id, menu_item_id, customer_id, author_name, rating, comment, created_at) FROM stdin;
1	3	20	Carl Angelo N.	4	masharap & mahahaba pa	2026-11-03 10:58:03.43872
\.


--
-- Data for Name: menu_item_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_item_variants (id, menu_item_id, name, price, is_available, display_order, created_at, variant_group_id) FROM stdin;
3	7	Hot	89.00	t	0	2026-11-02 12:23:52.388861	1
4	7	Iced	89.00	t	1	2026-11-02 12:23:52.388861	1
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_items (id, category_id, name, description, price, image_url, is_available, created_at, updated_at, is_deleted, deleted_at, display_order, image_public_id) FROM stdin;
8	9	Pork Siomai		80.00	https://res.cloudinary.com/roumuyf1/image/upload/v1791278948/bingnondo/menu/mxbjj9khk10vhp14azei.jpg	t	2026-10-03 22:27:18.789159	2026-10-16 08:13:51.740195	f	\N	0	bingnondo/menu/mxbjj9khk10vhp14azei
16	2	__rider_test_item_1792081677339_15	\N	10.00	\N	f	2026-10-16 00:27:57.339653	2026-10-16 00:27:57.339653	t	2026-10-16 08:11:01.476373	0	\N
81	2	__rider_test_item_1792082624065_15	\N	10.00	\N	f	2026-10-16 00:43:44.065801	2026-10-16 00:43:44.065801	t	2026-10-16 08:11:05.396549	0	\N
93	2	__rider_test_item_1792085792992_15	\N	10.00	\N	f	2026-10-16 01:36:32.993525	2026-10-16 01:36:32.993525	t	2026-10-16 08:11:08.528474	0	\N
108	2	__rider_test_item_1792103430187_15	\N	10.00	\N	f	2026-10-16 06:30:30.188356	2026-10-16 06:30:30.188356	t	2026-10-16 08:11:13.802144	0	\N
22	2	__status_test_1792081677818_6	\N	10.00	\N	f	2026-10-16 00:27:57.819579	2026-10-16 00:27:57.819579	t	2026-10-16 08:11:16.424346	0	\N
59	2	__status_test_1792082563168_6	\N	10.00	\N	f	2026-10-16 00:42:43.170302	2026-10-16 00:42:43.170302	t	2026-10-16 08:11:19.289016	0	\N
60	2	__status_test_1792082593188_7	\N	10.00	\N	f	2026-10-16 00:43:13.19062	2026-10-16 00:43:13.19062	t	2026-10-16 08:11:22.926324	0	\N
100	2	__status_test_1792085793894_6	\N	10.00	\N	f	2026-10-16 01:36:33.896234	2026-10-16 01:36:33.896234	t	2026-10-16 08:11:25.607341	0	\N
115	2	__status_test_1792103430932_6	\N	10.00	\N	f	2026-10-16 06:30:30.933366	2026-10-16 06:30:30.933366	t	2026-10-16 08:11:28.27394	0	\N
88	2	__test_item_1792085792792_0	\N	10.00	\N	f	2026-10-16 01:36:32.811757	2026-10-16 01:36:32.811757	t	2026-10-16 08:11:30.937742	0	\N
102	2	__test_item_1792103429941_0	\N	10.00	\N	f	2026-10-16 06:30:29.954995	2026-10-16 06:30:29.954995	t	2026-10-16 08:11:34.359794	0	\N
3	2	Shanghai Roll		120.00	https://res.cloudinary.com/roumuyf1/image/upload/v1791278938/bingnondo/menu/sjjlx2hgsozacbibvfwz.jpg	t	2026-10-03 22:24:21.187183	2026-10-16 08:15:19.447578	f	\N	0	bingnondo/menu/sjjlx2hgsozacbibvfwz
4	6	Xiao Long Bao		185.00	https://res.cloudinary.com/roumuyf1/image/upload/v1791278893/bingnondo/menu/lvctgtmzlxfgrrrqmkoj.jpg	t	2026-10-03 22:24:57.953809	2026-10-16 09:16:30.929838	f	\N	0	bingnondo/menu/lvctgtmzlxfgrrrqmkoj
9	10	Caramel Latte		80.00	https://res.cloudinary.com/roumuyf1/image/upload/v1791278928/bingnondo/menu/ttmoo1y7fptbcr1jvre1.jpg	t	2026-10-03 22:28:00.718096	2026-10-16 10:46:25.322309	f	\N	0	bingnondo/menu/ttmoo1y7fptbcr1jvre1
6	5	Oatmilk		30.00	https://res.cloudinary.com/roumuyf1/image/upload/v1791278881/bingnondo/menu/jz5bwtglkdjgnaizxxgn.jpg	t	2026-10-03 22:26:03.490677	2026-10-16 10:46:34.93389	f	\N	0	bingnondo/menu/jz5bwtglkdjgnaizxxgn
5	7	Sea Salt Latte		140.00	https://res.cloudinary.com/roumuyf1/image/upload/v1791278905/bingnondo/menu/mhofzitakdogohwqt0hq.jpg	t	2026-10-03 22:25:37.366712	2026-10-16 10:46:36.907881	f	\N	0	bingnondo/menu/mhofzitakdogohwqt0hq
7	8	Silky Chocolate Milk		100.00	https://res.cloudinary.com/roumuyf1/image/upload/v1791278915/bingnondo/menu/blqwf5nf8elhpnplad9x.jpg	t	2026-10-03 22:26:43.451792	2026-11-02 12:23:52.388861	f	\N	0	bingnondo/menu/blqwf5nf8elhpnplad9x
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, staff_id, target_role, type, reference_id, is_read, created_at, customer_id, message) FROM stdin;
1	\N	\N	support_chat_reply	1	f	2026-10-06 21:12:56.663981	\N	\N
2	\N	\N	support_chat_reply	2	f	2026-10-06 21:13:10.811127	\N	\N
5	\N	\N	order_status	1	t	2026-10-15 13:55:27.74457	20	Test lang — gumagana na!
6	\N	\N	support_chat_reply	2	f	2026-10-15 14:01:20.135559	\N	\N
7	\N	\N	order_status	15	t	2026-10-15 17:25:24.389714	20	The kitchen is now preparing your order.
8	\N	\N	order_status	15	t	2026-10-15 17:27:08.866559	20	Your order is ready! A rider will pick it up shortly.
9	\N	\N	order_pending	16	t	2026-10-15 22:16:58.528782	20	Your order has been placed! Waiting for confirmation.
11	\N	\N	payment_received	16	t	2026-10-16 00:05:40.972925	20	Your GCash payment has been verified! Your order is being processed.
13	\N	\N	order_ready	16	t	2026-10-16 00:07:34.602434	20	Your order is ready! A rider will pick it up shortly.
10	\N	\N	order_confirmed	16	t	2026-10-16 00:05:40.872168	20	Your order has been confirmed by Bingnondo Cafe.
12	\N	\N	order_preparing	16	t	2026-10-16 00:07:21.354343	20	The kitchen is now preparing your order.
14	\N	\N	order_pending	107	t	2026-10-16 03:04:31.601624	20	Your order has been placed! Waiting for confirmation.
15	\N	\N	order_confirmed	7	t	2026-10-16 07:50:49.012429	20	Your order has been confirmed by Bingnondo Cafe.
16	\N	\N	order_confirmed	12	t	2026-10-16 07:50:53.354371	20	Your order has been confirmed by Bingnondo Cafe.
17	\N	\N	order_confirmed	14	t	2026-10-16 07:50:54.706059	20	Your order has been confirmed by Bingnondo Cafe.
18	\N	\N	order_confirmed	107	t	2026-10-16 07:51:02.055755	20	Your order has been confirmed by Bingnondo Cafe.
19	\N	\N	order_preparing	4	t	2026-10-16 07:51:36.762398	20	The kitchen is now preparing your order.
20	\N	\N	order_preparing	5	t	2026-10-16 07:51:38.017648	20	The kitchen is now preparing your order.
21	\N	\N	order_preparing	12	t	2026-10-16 07:51:39.115766	20	The kitchen is now preparing your order.
22	\N	\N	order_preparing	7	t	2026-10-16 07:51:40.300616	20	The kitchen is now preparing your order.
23	\N	\N	order_ready	4	t	2026-10-16 07:52:50.592048	20	Your order is ready! A rider will pick it up shortly.
24	\N	\N	order_ready	5	t	2026-10-16 07:52:52.80266	20	Your order is ready! A rider will pick it up shortly.
25	\N	\N	order_ready	12	t	2026-10-16 07:52:53.854663	20	Your order is ready! A rider will pick it up shortly.
26	\N	\N	order_ready	7	t	2026-10-16 07:52:55.158341	20	Your order is ready! A rider will pick it up shortly.
27	\N	\N	order_preparing	13	t	2026-10-16 07:52:56.528936	20	The kitchen is now preparing your order.
28	\N	\N	order_ready	13	t	2026-10-16 07:53:17.2887	20	Your order is ready! A rider will pick it up shortly.
29	\N	\N	order_preparing	14	t	2026-10-16 07:53:18.794916	20	The kitchen is now preparing your order.
30	\N	\N	order_preparing	107	t	2026-10-16 07:53:27.242564	20	The kitchen is now preparing your order.
31	\N	\N	order_ready	14	t	2026-10-16 07:54:07.422823	20	Your order is ready! A rider will pick it up shortly.
32	\N	\N	order_ready	107	t	2026-10-16 07:54:09.655478	20	Your order is ready! A rider will pick it up shortly.
33	\N	\N	order_pending	122	t	2026-10-16 09:22:09.17883	20	Your order has been placed! Waiting for confirmation.
34	\N	\N	order_pending	123	t	2026-10-16 10:25:10.308007	20	Your order has been placed! Waiting for confirmation.
35	\N	\N	payment_received	123	t	2026-10-16 10:26:39.722805	20	Your GCash payment has been verified! Your order is being processed.
36	\N	\N	order_confirmed	123	t	2026-10-16 10:26:39.736918	20	Your order has been confirmed by Bingnondo Cafe.
37	\N	\N	order_confirmed	122	t	2026-10-16 10:27:26.697208	20	Your order has been confirmed by Bingnondo Cafe.
38	\N	\N	order_preparing	123	t	2026-10-16 10:27:40.044893	20	The kitchen is now preparing your order.
39	\N	\N	order_ready	123	t	2026-10-16 10:28:24.153391	20	Your order is ready! A rider will pick it up shortly.
40	\N	\N	order_pending	124	t	2026-10-16 10:36:33.358941	20	Your order has been placed! Waiting for confirmation.
41	\N	\N	order_pending	125	t	2026-10-16 10:41:48.353679	20	Your order has been placed! Waiting for confirmation.
42	\N	\N	order_confirmed	125	t	2026-10-16 10:42:23.729547	20	Your order has been confirmed by Bingnondo Cafe.
43	\N	\N	order_preparing	125	t	2026-10-16 10:42:41.712074	20	The kitchen is now preparing your order.
44	\N	\N	order_ready	125	t	2026-10-16 10:42:47.884342	20	Your order is ready! A rider will pick it up shortly.
45	\N	\N	order_pending	126	f	2026-10-18 16:02:28.588804	20	Your order has been placed! Waiting for confirmation.
46	\N	\N	order_pending	127	f	2026-10-19 15:25:47.430366	20	Your order has been placed! Waiting for confirmation.
47	\N	\N	payment_failed	127	t	2026-10-19 15:40:47.026937	20	Your GCash receipt was rejected. Please re-upload a clear screenshot.
48	\N	\N	order_pending	128	f	2026-10-19 15:44:52.410172	20	Your order has been placed! Waiting for confirmation.
49	\N	\N	payment_failed	128	t	2026-10-19 21:09:22.391137	20	Your GCash receipt was rejected. Please re-upload a clear screenshot.
50	\N	\N	order_pending	129	f	2026-10-20 21:31:20.321333	20	Your order has been placed! Waiting for confirmation.
51	\N	\N	order_confirmed	129	f	2026-10-20 21:31:46.526598	20	Your order has been confirmed by Bingnondo Cafe.
52	\N	\N	order_preparing	129	f	2026-10-20 21:37:11.312018	20	The kitchen is now preparing your order.
53	\N	\N	order_ready	129	f	2026-10-20 21:37:37.079938	20	Your order is ready! A rider will pick it up shortly.
54	\N	\N	payment_failed	128	t	2026-10-21 17:16:22.003667	20	Your GCash receipt was rejected. Please re-upload a clear screenshot.
55	\N	\N	payment_failed	128	t	2026-10-21 17:46:49.098647	20	Your GCash receipt was rejected. Please re-upload a clear screenshot.
56	\N	\N	order_pending	130	f	2026-10-21 17:51:56.306091	20	Your order has been placed! Waiting for confirmation.
57	\N	\N	payment_failed	128	t	2026-10-21 18:51:41.456585	20	Your GCash receipt was rejected. Please re-upload a clear screenshot.
58	\N	\N	payment_failed	127	f	2026-10-21 21:18:52.769949	20	Your GCash receipt was rejected. Please re-upload a clear screenshot.
59	\N	\N	order_confirmed	130	f	2026-11-03 14:29:11.000998	20	Your order has been confirmed by Bingnondo Cafe.
60	\N	\N	order_preparing	130	f	2026-11-03 14:29:22.763158	20	The kitchen is now preparing your order.
61	\N	\N	order_ready	130	f	2026-11-03 14:29:24.350594	20	Your order is ready! A rider will pick it up shortly.
62	\N	\N	order_pending	131	f	2026-11-03 15:08:03.871305	20	Your order has been placed! Waiting for confirmation.
63	\N	\N	order_confirmed	131	f	2026-11-03 15:08:57.808706	20	Your order has been confirmed by Bingnondo Cafe.
64	\N	\N	order_preparing	131	f	2026-11-03 15:09:13.053236	20	The kitchen is now preparing your order.
65	\N	\N	order_ready	131	f	2026-11-03 15:09:15.003876	20	Your order is ready! A rider will pick it up shortly.
66	\N	\N	order_pending	132	f	2026-11-04 08:49:39.063974	20	Your order has been placed! Waiting for confirmation.
67	\N	\N	order_confirmed	132	f	2026-11-04 10:11:38.15892	20	Your order has been confirmed by Bingnondo Cafe.
68	\N	\N	payment_received	128	f	2026-11-04 10:11:49.66797	20	Your GCash payment has been verified! Your order is being processed.
69	\N	\N	order_confirmed	128	f	2026-11-04 10:11:49.735736	20	Your order has been confirmed by Bingnondo Cafe.
70	\N	\N	order_preparing	132	f	2026-11-04 10:12:15.66581	20	The kitchen is now preparing your order.
71	\N	\N	order_ready	132	f	2026-11-04 10:12:17.220128	20	Your order is ready! A rider will pick it up shortly.
72	\N	\N	order_preparing	128	f	2026-11-04 10:12:56.948425	20	The kitchen is now preparing your order.
73	\N	\N	order_ready	128	f	2026-11-04 10:12:58.171345	20	Your order is ready! A rider will pick it up shortly.
74	\N	\N	order_pending	133	f	2026-11-04 17:13:06.985943	20	Your order has been placed! Waiting for confirmation.
75	\N	\N	order_confirmed	133	f	2026-11-05 18:06:16.93431	20	Your order has been confirmed by Bingnondo Cafe.
76	\N	\N	order_preparing	133	f	2026-11-05 18:06:31.001799	20	The kitchen is now preparing your order.
77	\N	\N	order_ready	133	f	2026-11-05 18:06:32.54539	20	Your order is ready! A rider will pick it up shortly.
80	\N	\N	order_pending	221	f	2026-11-10 00:27:56.070548	20	Your order has been placed! Waiting for confirmation.
81	\N	\N	order_cancelled	221	f	2026-11-10 00:32:26.554738	20	Your order has been cancelled.
82	\N	\N	order_pending	222	f	2026-11-10 00:32:53.726245	20	Your order has been placed! Waiting for confirmation.
83	\N	\N	order_pending	223	f	2026-11-10 11:32:15.888167	20	Your order has been placed! Waiting for confirmation.
84	\N	\N	order_pending	224	f	2026-11-10 11:38:12.55951	20	Your order has been placed! Waiting for confirmation.
85	\N	\N	order_pending	225	f	2026-11-10 11:46:45.441345	20	Your order has been placed! Waiting for confirmation.
86	\N	\N	order_confirmed	225	f	2026-11-10 11:56:53.022874	20	Your order has been confirmed by Bingnondo Cafe.
87	\N	\N	order_preparing	225	f	2026-11-10 11:57:57.73303	20	The kitchen is now preparing your order.
88	\N	\N	order_ready	225	f	2026-11-10 11:57:59.71754	20	Your order is ready! A rider will pick it up shortly.
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, menu_item_id, quantity, unit_price, notes, variant_id, variant_name) FROM stdin;
224	221	3	1	120.00	\N	\N	\N
225	222	3	1	120.00	\N	\N	\N
226	223	3	1	120.00	\N	\N	\N
227	224	4	1	185.00	\N	\N	\N
228	225	5	1	140.00	\N	\N	\N
130	127	3	1	120.00	\N	\N	\N
131	128	3	1	120.00	\N	\N	\N
132	129	3	1	120.00	\N	\N	\N
133	130	6	1	30.00	\N	\N	\N
134	131	3	1	120.00	\N	\N	\N
135	132	3	1	120.00	\N	\N	\N
136	133	6	1	30.00	\N	\N	\N
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_status_history (id, order_id, status, changed_by, changed_at) FROM stdin;
127	127	pending	\N	2026-10-19 15:25:47.252536
128	128	pending	\N	2026-10-19 15:44:52.333693
129	129	pending	\N	2026-10-20 21:31:20.075619
130	129	confirmed	2	2026-10-20 21:31:46.219413
131	129	preparing	12	2026-10-20 21:37:11.117643
132	129	ready	12	2026-10-20 21:37:37.038053
133	129	out_for_delivery	\N	2026-10-20 21:38:01.143911
134	129	completed	\N	2026-10-20 21:39:40.532541
135	130	pending	\N	2026-10-21 17:51:56.176648
136	130	confirmed	2	2026-11-03 14:29:10.636153
137	130	preparing	12	2026-11-03 14:29:22.722625
138	130	ready	12	2026-11-03 14:29:24.330317
139	131	pending	\N	2026-11-03 15:08:03.583324
140	131	confirmed	2	2026-11-03 15:08:57.60408
141	131	preparing	12	2026-11-03 15:09:13.010173
142	131	ready	12	2026-11-03 15:09:14.984739
143	130	out_for_delivery	\N	2026-11-03 15:09:33.578964
144	130	completed	\N	2026-11-03 15:09:35.970144
145	131	out_for_delivery	\N	2026-11-03 15:10:04.818563
146	132	pending	\N	2026-11-04 08:49:38.800818
147	132	confirmed	2	2026-11-04 10:11:37.973222
148	128	confirmed	2	2026-11-04 10:11:49.574839
149	132	preparing	12	2026-11-04 10:12:15.613103
150	132	ready	12	2026-11-04 10:12:17.189783
151	128	preparing	12	2026-11-04 10:12:56.924352
152	128	ready	12	2026-11-04 10:12:58.155632
153	132	out_for_delivery	\N	2026-11-04 13:41:36.160369
154	132	completed	\N	2026-11-04 13:41:47.912304
155	128	out_for_delivery	\N	2026-11-04 13:42:03.281025
156	133	pending	\N	2026-11-04 17:13:06.818007
157	128	completed	\N	2026-11-05 18:05:49.569946
158	133	confirmed	2	2026-11-05 18:06:16.69019
159	133	preparing	12	2026-11-05 18:06:30.960195
160	133	ready	12	2026-11-05 18:06:32.510989
161	133	out_for_delivery	\N	2026-11-05 18:27:09.441649
218	133	completed	\N	2026-11-09 19:35:45.786927
219	221	pending	\N	2026-11-10 00:27:55.832074
220	221	cancelled	2	2026-11-10 00:32:26.34846
221	222	pending	\N	2026-11-10 00:32:53.636603
222	223	pending	\N	2026-11-10 11:32:15.748756
223	224	pending	\N	2026-11-10 11:38:12.466571
224	225	pending	\N	2026-11-10 11:46:45.358027
225	225	confirmed	2	2026-11-10 11:56:52.780837
226	225	preparing	12	2026-11-10 11:57:57.702673
227	225	ready	12	2026-11-10 11:57:59.705505
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, order_type, customer_id, cashier_id, status, order_channel, total_amount, special_request, created_at, updated_at, order_number, delivery_address, delivery_latitude, delivery_longitude, delivery_fee) FROM stdin;
133	online	20	\N	completed	mobile_app	30.00	\N	2026-11-04 17:13:06.818007	2026-11-09 19:35:45.786927	BNG-20261104-0002	Villa Josefina, Santa Cruz, Laguna, 4009, Philippines	14.2788196	121.4117173	0.00
127	online	20	\N	pending	mobile_app	120.00	\N	2026-10-19 15:25:47.252536	2026-10-19 15:25:47.252536	BNG-20261019-0001	hindi makamove on st. brgy. sinaktan	\N	\N	0.00
221	online	20	\N	cancelled	mobile_app	189.00	\N	2026-11-10 00:27:55.832074	2026-11-10 00:32:26.34846	BNG-20261109-0001	Villa Josefina, Santa Cruz, Laguna, 4009, Philippines	14.2788196	121.4117173	69.00
222	online	20	\N	pending	mobile_app	189.00	\N	2026-11-10 00:32:53.636603	2026-11-10 00:32:53.636603	BNG-20261109-0002	Villa Josefina, Santa Cruz, Laguna, 4009, Philippines	14.2788196	121.4117173	69.00
223	online	20	\N	pending	mobile_app	189.00	\N	2026-11-10 11:32:15.748756	2026-11-10 11:32:15.748756	BNG-20261110-0003	Villa Josefina, Santa Cruz, Laguna, 4009, Philippines	14.2788196	121.4117173	69.00
224	online	20	\N	pending	mobile_app	254.00	\N	2026-11-10 11:38:12.466571	2026-11-10 11:38:12.466571	BNG-20261110-0004	Villa Josefina, Santa Cruz, Laguna, 4009, Philippines	14.2788196	121.4117173	69.00
129	online	20	\N	completed	mobile_app	120.00	\N	2026-10-20 21:31:20.075619	2026-10-20 21:39:40.532541	BNG-20261020-0001	P. Guevarra Road, Pagsawitan, Santa Cruz, Laguna, 4009, Philippines	14.2728240	121.4193703	0.00
225	online	20	\N	ready	mobile_app	140.00	\N	2026-11-10 11:46:45.358027	2026-11-10 11:57:59.705505	BNG-20261110-0005	\N	\N	\N	0.00
130	online	20	\N	completed	mobile_app	30.00	\N	2026-10-21 17:51:56.176648	2026-11-03 15:09:35.970144	BNG-20261021-0001	hindi makamove on st. brgy. sinaktan	\N	\N	0.00
131	online	20	\N	out_for_delivery	mobile_app	120.00	\N	2026-11-03 15:08:03.583324	2026-11-03 15:10:04.818563	BNG-20261103-0001	Pedro Guevarra Avenue, Pagsawitan, Santa Cruz, Laguna, 4009, Philippines	14.2741348	121.4188842	0.00
132	online	20	\N	completed	mobile_app	120.00	\N	2026-11-04 08:49:38.800818	2026-11-04 13:41:47.912304	BNG-20261104-0001	General Cailles Street, Barangay III, Santa Cruz, Laguna, 4009, Philippines	14.2818000	121.4149000	0.00
128	online	20	\N	completed	mobile_app	120.00	\N	2026-10-19 15:44:52.333693	2026-11-05 18:05:49.569946	BNG-20261019-0002	hindi makamove on st. brgy. sinaktan	\N	\N	0.00
\.


--
-- Data for Name: otp_verifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otp_verifications (id, contact, otp_code, purpose, expires_at, verified_at, created_at, consumed_at) FROM stdin;
1	carlnovero29@gmail.com	901751	email_verification	2026-09-29 09:20:59.31	2026-09-29 09:11:57.62528	2026-09-29 09:10:59.312315	\N
2	carlnovero29@gmail.com	375297	email_verification	2026-09-29 09:55:10.33726	2026-09-29 09:45:34.14595	2026-09-29 09:45:10.33726	\N
3	carlnovero29@gmail.com	595297	email_verification	2026-09-29 10:00:46.346208	2026-09-29 09:51:30.452735	2026-09-29 09:50:46.346208	\N
4	carlnovero29@gmail.com	786017	email_verification	2026-09-29 10:25:14.442452	2026-09-29 10:15:56.944205	2026-09-29 10:15:14.442452	\N
5	carlnovero29@gmail.com	984231	email_verification	2026-09-29 10:27:55.338462	2026-09-29 10:19:30.409338	2026-09-29 10:17:55.338462	\N
6	carlnovero29@gmail.com	960948	email_verification	2026-09-29 11:59:26.454677	2026-09-29 11:50:03.711219	2026-09-29 11:49:26.454677	\N
7	carlnovero29@gmail.com	200377	email_verification	2026-09-29 12:00:03.722281	2026-09-29 11:50:26.586533	2026-09-29 11:50:03.722281	\N
8	carlnovero29@gmail.com	828001	email_verification	2026-09-29 14:39:00.650072	2026-09-29 14:30:08.97561	2026-09-29 14:29:00.650072	\N
9	carlnovero29@gmail.com	892909	email_verification	2026-09-29 14:50:38.687464	2026-09-29 14:41:18.781277	2026-09-29 14:40:38.687464	\N
10	carlnovero29@gmail.com	412520	email_verification	2026-09-29 14:59:51.979811	2026-09-29 14:50:15.751985	2026-09-29 14:49:51.979811	\N
11	carlnovero29@gmail.com	556570	email_verification	2026-09-29 15:02:26.369249	2026-09-29 14:52:46.50403	2026-09-29 14:52:26.369249	\N
12	carlnovero29@gmail.com	290211	email_verification	2026-09-29 15:38:54.156677	2026-09-29 15:29:19.504026	2026-09-29 15:28:54.156677	\N
13	carlnovero29@gmail.com	717684	email_verification	2026-09-29 15:44:52.195774	2026-09-29 15:35:16.263361	2026-09-29 15:34:52.195774	\N
14	carlnovero29@gmail.com	633018	email_verification	2026-09-29 15:49:35.006469	2026-09-29 15:39:52.979172	2026-09-29 15:39:35.006469	\N
15	carlnovero29@gmail.com	895744	email_verification	2026-09-29 16:00:18.115721	2026-09-29 15:50:42.939234	2026-09-29 15:50:18.115721	\N
16	carlnovero29@gmail.com	602787	email_verification	2026-09-29 16:20:39.118076	2026-09-29 16:11:06.32526	2026-09-29 16:10:39.118076	\N
17	carlnovero29@gmail.com	987581	email_verification	2026-09-29 16:24:41.536287	2026-09-29 16:15:03.728359	2026-09-29 16:14:41.536287	\N
18	carlnovero29@gmail.com	932768	email_verification	2026-09-29 16:45:17.516658	2026-09-29 16:36:11.841867	2026-09-29 16:35:17.516658	\N
19	carlnovero29@gmail.com	276820	email_verification	2026-09-29 19:42:57.078494	2026-09-29 19:34:07.211688	2026-09-29 19:32:57.078494	\N
20	carlnovero29@gmail.com	955259	email_verification	2026-09-29 19:44:07.215888	2026-09-29 19:34:37.352582	2026-09-29 19:34:07.215888	\N
21	carlnovero29@gmail.com	916560	password_reset	2026-09-29 19:45:09.421352	2026-09-29 19:35:37.583529	2026-09-29 19:35:09.421352	\N
22	carlnovero29@gmail.com	805036	password_reset	2026-09-29 19:46:36.020838	2026-09-29 19:36:55.469633	2026-09-29 19:36:36.020838	\N
23	carlnovero29@gmail.com	431659	email_verification	2026-09-30 12:10:44.353707	2026-09-30 12:01:19.4024	2026-09-30 12:00:44.353707	\N
24	carlnovero29@gmail.com	156934	email_verification	2026-09-30 12:20:14.995561	2026-09-30 12:10:37.927383	2026-09-30 12:10:14.995561	\N
25	carlnovero29@gmail.com	491039	password_reset	2026-09-30 12:23:40.221883	\N	2026-09-30 12:13:40.221883	\N
26	carlnovero29@gmail.com	531377	password_reset	2026-09-30 12:50:04.383225	\N	2026-09-30 12:40:04.383225	\N
27	carlnovero29@gmail.com	986261	password_reset	2026-09-30 13:04:15.78666	2026-09-30 12:54:43.027424	2026-09-30 12:54:15.78666	\N
28	carlnovero29@gmail.com	892232	password_reset	2026-09-30 20:55:34.834299	2026-09-30 20:46:12.509272	2026-09-30 20:45:34.834299	\N
29	carlnovero29@gmail.com	493079	password_reset	2026-09-30 21:25:22.688401	2026-09-30 21:16:06.981427	2026-09-30 21:15:22.688401	\N
90	09817331308	704914	mobile_verification	2026-11-09 15:49:38.601417	2026-11-09 15:40:05.59602	2026-11-09 15:39:38.601417	\N
91	09817331308	468674	mobile_verification	2026-11-09 16:34:05.354523	2026-11-09 16:24:15.966522	2026-11-09 16:24:05.354523	\N
92	09709693223	657059	mobile_verification	2026-11-09 20:13:24.816261	2026-11-09 20:03:42.488817	2026-11-09 20:03:24.816261	\N
\.


--
-- Data for Name: payment_qr_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_qr_codes (id, name, number, image_url, image_public_id, is_active, display_order, created_by, created_at, updated_at) FROM stdin;
1	GcaS ko	09123456789	https://res.cloudinary.com/roumuyf1/image/upload/v1794209173/bingnondo/qr_codes/woaazowhh7fins3h2g6j.jpg	bingnondo/qr_codes/woaazowhh7fins3h2g6j	t	0	5	2026-11-09 15:26:15.277296	2026-11-09 15:26:29.166797
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, order_id, method, amount, paymongo_payment_id, status, paid_at, created_at, gcash_ref_number, receipt_image_url, receipt_uploaded_at, verified_by, verified_at, rejection_reason, gcash_amount_sent, rejected_at, resubmitted_at, rejection_count, previous_receipt_image_url, previous_rejection_reason) FROM stdin;
177	221	cash_on_delivery	189.00	\N	pending	\N	2026-11-10 00:27:55.832074	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
178	222	cash_on_delivery	189.00	\N	pending	\N	2026-11-10 00:32:53.636603	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
179	223	cash_on_delivery	189.00	\N	pending	\N	2026-11-10 11:32:15.748756	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
180	224	cash_on_delivery	254.00	\N	pending	\N	2026-11-10 11:38:12.466571	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
181	225	cash_on_delivery	140.00	\N	pending	\N	2026-11-10 11:46:45.358027	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
91	129	cash_on_delivery	120.00	\N	pending	\N	2026-10-20 21:31:20.075619	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
92	130	cash_on_delivery	30.00	\N	pending	\N	2026-10-21 17:51:56.176648	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
89	127	gcash	120.00	\N	rejected	\N	2026-10-19 15:25:47.252536	0046175868012	https://res.cloudinary.com/roumuyf1/image/upload/v1792527207/bingnondo/gcash_receipts/gcash_undefined_1792527206874.jpg	2026-10-21 04:13:31.523508	\N	\N	Expired receipt	105.00	2026-10-21 21:18:52.589528	\N	1	\N	Expired receipt
93	131	cash_on_delivery	120.00	\N	pending	\N	2026-11-03 15:08:03.583324	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
94	132	cash_on_delivery	120.00	\N	pending	\N	2026-11-04 08:49:38.800818	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
90	128	gcash	120.00	\N	paid	2026-11-04 10:11:49.574839	2026-10-19 15:44:52.333693	0046175868012	https://res.cloudinary.com/roumuyf1/image/upload/v1792579931/bingnondo/gcash_receipts/gcash_undefined_1792579931336.jpg	2026-10-21 18:52:15.550338	2	2026-11-04 10:11:49.574839	\N	105.00	2026-10-21 18:51:41.415239	\N	3	https://res.cloudinary.com/roumuyf1/image/upload/v1792576035/bingnondo/gcash_receipts/gcash_undefined_1792576034880.jpg	\N
95	133	cash_on_delivery	30.00	\N	pending	\N	2026-11-04 17:13:06.818007	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N
\.


--
-- Data for Name: pending_registrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pending_registrations (email, password_hash, expires_at, created_at, mobile_number, id) FROM stdin;
\.


--
-- Data for Name: rider_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rider_locations (rider_id, latitude, longitude, accuracy, updated_at) FROM stdin;
39	14.1349504	121.4139715	149	2026-11-06 09:44:14.484221
\.


--
-- Data for Name: riders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.riders (id, mobile_number, plate_number, vehicle_type, notes, status, created_by, created_at, updated_at, email, password_hash, last_login, first_name, middle_name, last_name, work_status, work_status_set_at, admin_work_override, admin_work_override_at, profile_image_url, profile_image_public_id) FROM stdin;
39	09123456789	juan@email.com	motorcycle	\N	available	5	2026-10-20 16:43:45.764962	2026-11-10 11:31:39.290258	juan@email.com	$2b$12$ITawvPhDHnWl1NCJljYm7Ou2lZbv0bzTbB5hujyA7z/jby3AtjDM.	2026-11-10 01:12:21.8265	juan	\N	juan	off	2026-11-10 01:04:06.734241	off	2026-11-10 11:31:39.290258	https://res.cloudinary.com/roumuyf1/image/upload/v1794244329/bingnondo/rider_profiles/uaeqpvp0mxxan8akengc.png	bingnondo/rider_profiles/uaeqpvp0mxxan8akengc
\.


--
-- Data for Name: staff_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_accounts (id, email, password_hash, role, status, created_by, created_at, updated_at, notification_seen_at, first_name, middle_name, last_name, profile_image_url, profile_image_public_id) FROM stdin;
12	kitchen@bingnondo.com	$2b$12$w43ceh6xozgo1ccKmNtT2OU15hDyLKuVSrKaBgUZDNQMtKQ6z1dyW	kitchen_staff	active	5	2026-10-08 11:40:03.783637	2026-10-20 21:36:30.863269	\N	carl	\N	angelo	\N	\N
2	cashier@bingnondo.com	$2b$12$Nb/ro88t7FLMsyCDbMEcbuD1z666oY7xwONE85l9EVvuKEkJj7MiW	cashier	active	\N	2026-09-22 07:27:56.909594	2026-11-10 00:58:54.498031	\N	Cashier	\N	One	https://res.cloudinary.com/roumuyf1/image/upload/v1794243533/bingnondo/staff_profiles/nyr1egukbl1dp3wncvpv.jpg	bingnondo/staff_profiles/nyr1egukbl1dp3wncvpv
5	admin@bingnondo.com	$2b$12$OMGjTVN/nCjbfpyZDl9TXurgHB8nW6E1saDKRbM.amzVfM4Dp/gO6	admin	active	\N	2026-09-22 07:27:58.038776	2026-11-10 01:03:00.587834	\N	System	\N	Admin	https://res.cloudinary.com/roumuyf1/image/upload/v1794243779/bingnondo/staff_profiles/ouujngu3snaejqtt03zy.jpg	bingnondo/staff_profiles/ouujngu3snaejqtt03zy
\.


--
-- Data for Name: staff_dashboard_access; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_dashboard_access (id, staff_id, target_dashboard, granted_by, granted_at) FROM stdin;
1	5	cashier	5	2026-10-01 10:57:55.764824
2	5	kitchen_staff	5	2026-10-01 10:57:55.764824
3	5	staff	5	2026-10-01 10:57:55.764824
4	5	owner	5	2026-10-01 10:57:55.764824
5	2	staff	5	2026-10-01 11:07:39.33355
\.


--
-- Data for Name: staff_switch_pin; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_switch_pin (staff_id, pin_hash, set_by_admin, updated_at) FROM stdin;
\.


--
-- Data for Name: support_chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.support_chat_messages (id, chat_id, sender_type, sender_id, related_order_id, content, sent_at, is_read) FROM stdin;
1	1	customer	20	\N	hi	2026-10-15 14:00:42.288068	f
2	1	staff	2	\N	how can i help you??	2026-10-15 14:01:20.130199	f
3	1	customer	20	\N	asan na order ko	2026-10-16 02:39:54.128283	f
6	1	customer	20	127	hi	2026-11-10 00:34:03.365787	f
7	1	customer	20	127	hi	2026-11-10 00:34:21.554936	f
8	1	customer	20	127	yoww	2026-11-10 00:37:31.292603	f
\.


--
-- Data for Name: support_chats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.support_chats (id, customer_id, status, opened_at, locked_at) FROM stdin;
1	20	unlocked	2026-10-06 20:59:28.040405	2026-10-08 06:13:32.544934
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (key, value, updated_at) FROM stdin;
notifications	{"categories": {"orders": true, "system": true, "kitchen": true, "payments": true, "customers": true, "inventory": true, "deliveries": true}}	2026-11-09 12:27:00.299315
delivery_fee	{"amount": 69, "enabled": true}	2026-11-09 22:00:07.41802
\.


--
-- Data for Name: variant_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.variant_groups (id, name, created_at, updated_at, max_options) FROM stdin;
1	Hot/Cold	2026-11-02 12:21:19.341895	2026-11-02 12:22:16.48616	2
\.


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 192, true);


--
-- Name: business_hours_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.business_hours_id_seq', 7, true);


--
-- Name: chatbot_conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chatbot_conversations_id_seq', 7, true);


--
-- Name: chatbot_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chatbot_messages_id_seq', 20, true);


--
-- Name: customer_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_notifications_id_seq', 55, true);


--
-- Name: customer_order_violations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_order_violations_id_seq', 1, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 134, true);


--
-- Name: dashboard_switch_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.dashboard_switch_config_id_seq', 2, true);


--
-- Name: deliveries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.deliveries_id_seq', 98, true);


--
-- Name: delivery_batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_batches_id_seq', 2, true);


--
-- Name: esp32_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.esp32_devices_id_seq', 1, true);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_items_id_seq', 37, true);


--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_transactions_id_seq', 29, true);


--
-- Name: kitchen_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kitchen_alerts_id_seq', 23, true);


--
-- Name: menu_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_categories_id_seq', 19, true);


--
-- Name: menu_item_reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_item_reviews_id_seq', 9, true);


--
-- Name: menu_item_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_item_variants_id_seq', 24, true);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 186, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 88, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 228, true);


--
-- Name: order_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_status_history_id_seq', 227, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 225, true);


--
-- Name: otp_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.otp_verifications_id_seq', 92, true);


--
-- Name: payment_qr_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_qr_codes_id_seq', 1, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payments_id_seq', 181, true);


--
-- Name: pending_registrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pending_registrations_id_seq', 3, true);


--
-- Name: riders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.riders_id_seq', 39, true);


--
-- Name: staff_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.staff_accounts_id_seq', 12, true);


--
-- Name: staff_dashboard_access_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.staff_dashboard_access_id_seq', 11, true);


--
-- Name: support_chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.support_chat_messages_id_seq', 8, true);


--
-- Name: support_chats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.support_chats_id_seq', 82, true);


--
-- Name: variant_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.variant_groups_id_seq', 10, true);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: business_hours business_hours_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_day_of_week_key UNIQUE (day_of_week);


--
-- Name: business_hours business_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_pkey PRIMARY KEY (id);


--
-- Name: chatbot_conversations chatbot_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_pkey PRIMARY KEY (id);


--
-- Name: chatbot_messages chatbot_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_pkey PRIMARY KEY (id);


--
-- Name: customer_notifications customer_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_pkey PRIMARY KEY (id);


--
-- Name: customer_order_violations customer_order_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_order_violations
    ADD CONSTRAINT customer_order_violations_pkey PRIMARY KEY (id);


--
-- Name: customer_restrictions customer_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_restrictions
    ADD CONSTRAINT customer_restrictions_pkey PRIMARY KEY (customer_id);


--
-- Name: customers customers_mobile_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_mobile_number_key UNIQUE (mobile_number);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: dashboard_switch_config dashboard_switch_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_switch_config
    ADD CONSTRAINT dashboard_switch_config_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_order_id_key UNIQUE (order_id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: delivery_batches delivery_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_batches
    ADD CONSTRAINT delivery_batches_pkey PRIMARY KEY (id);


--
-- Name: esp32_devices esp32_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esp32_devices
    ADD CONSTRAINT esp32_devices_pkey PRIMARY KEY (id);


--
-- Name: esp32_wifi_configs esp32_wifi_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esp32_wifi_configs
    ADD CONSTRAINT esp32_wifi_configs_pkey PRIMARY KEY (device_id);


--
-- Name: inventory_item_categories inventory_item_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_item_categories
    ADD CONSTRAINT inventory_item_categories_pkey PRIMARY KEY (inventory_item_id, category_id);


--
-- Name: inventory_items inventory_items_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_name_key UNIQUE (name);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: kitchen_alerts kitchen_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_alerts
    ADD CONSTRAINT kitchen_alerts_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_name_key UNIQUE (name);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_category_variant_groups menu_category_variant_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_category_variant_groups
    ADD CONSTRAINT menu_category_variant_groups_pkey PRIMARY KEY (category_id, variant_group_id);


--
-- Name: menu_item_ingredients menu_item_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_ingredients
    ADD CONSTRAINT menu_item_ingredients_pkey PRIMARY KEY (menu_item_id, inventory_item_id);


--
-- Name: menu_item_reviews menu_item_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_reviews
    ADD CONSTRAINT menu_item_reviews_pkey PRIMARY KEY (id);


--
-- Name: menu_item_variants menu_item_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variants
    ADD CONSTRAINT menu_item_variants_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: payment_qr_codes payment_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_qr_codes
    ADD CONSTRAINT payment_qr_codes_pkey PRIMARY KEY (id);


--
-- Name: payments payments_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_key UNIQUE (order_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pending_registrations pending_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_pkey PRIMARY KEY (id);


--
-- Name: rider_locations rider_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_locations
    ADD CONSTRAINT rider_locations_pkey PRIMARY KEY (rider_id);


--
-- Name: riders riders_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riders
    ADD CONSTRAINT riders_email_key UNIQUE (email);


--
-- Name: riders riders_mobile_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riders
    ADD CONSTRAINT riders_mobile_number_key UNIQUE (mobile_number);


--
-- Name: riders riders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riders
    ADD CONSTRAINT riders_pkey PRIMARY KEY (id);


--
-- Name: staff_accounts staff_accounts_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_accounts
    ADD CONSTRAINT staff_accounts_email_key UNIQUE (email);


--
-- Name: staff_accounts staff_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_accounts
    ADD CONSTRAINT staff_accounts_pkey PRIMARY KEY (id);


--
-- Name: staff_dashboard_access staff_dashboard_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_dashboard_access
    ADD CONSTRAINT staff_dashboard_access_pkey PRIMARY KEY (id);


--
-- Name: staff_dashboard_access staff_dashboard_access_staff_id_target_dashboard_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_dashboard_access
    ADD CONSTRAINT staff_dashboard_access_staff_id_target_dashboard_key UNIQUE (staff_id, target_dashboard);


--
-- Name: staff_switch_pin staff_switch_pin_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_switch_pin
    ADD CONSTRAINT staff_switch_pin_pkey PRIMARY KEY (staff_id);


--
-- Name: support_chat_messages support_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chat_messages
    ADD CONSTRAINT support_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: support_chats support_chats_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_customer_id_key UNIQUE (customer_id);


--
-- Name: support_chats support_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: dashboard_switch_config uq_switch_config_dashboard; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_switch_config
    ADD CONSTRAINT uq_switch_config_dashboard UNIQUE (target_dashboard) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: dashboard_switch_config uq_switch_config_staff; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_switch_config
    ADD CONSTRAINT uq_switch_config_staff UNIQUE (staff_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: variant_groups variant_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variant_groups
    ADD CONSTRAINT variant_groups_pkey PRIMARY KEY (id);


--
-- Name: customers_email_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX customers_email_unique ON public.customers USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: customers_mobile_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX customers_mobile_unique ON public.customers USING btree (mobile_number) WHERE (mobile_number IS NOT NULL);


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_actor ON public.audit_log USING btree (actor_id);


--
-- Name: idx_customer_notifications_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_notifications_customer ON public.customer_notifications USING btree (customer_id, created_at DESC);


--
-- Name: idx_deliveries_rider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliveries_rider ON public.deliveries USING btree (rider_id);


--
-- Name: idx_deliveries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliveries_status ON public.deliveries USING btree (status);


--
-- Name: idx_delivery_batches_rider_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_delivery_batches_rider_status ON public.delivery_batches USING btree (rider_id, status);


--
-- Name: idx_dsc_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dsc_staff_id ON public.dashboard_switch_config USING btree (staff_id) WHERE (staff_id IS NOT NULL);


--
-- Name: idx_dsc_target_dashboard; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dsc_target_dashboard ON public.dashboard_switch_config USING btree (target_dashboard) WHERE (target_dashboard IS NOT NULL);


--
-- Name: idx_esp32_devices_device_code_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_esp32_devices_device_code_unique ON public.esp32_devices USING btree (device_code);


--
-- Name: idx_inventory_item_categories_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_item_categories_category_id ON public.inventory_item_categories USING btree (category_id);


--
-- Name: idx_inventory_txn_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_txn_item ON public.inventory_transactions USING btree (inventory_item_id);


--
-- Name: idx_kitchen_alerts_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kitchen_alerts_order ON public.kitchen_alerts USING btree (order_id);


--
-- Name: idx_menu_categories_display_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_categories_display_order ON public.menu_categories USING btree (display_order, id);


--
-- Name: idx_menu_category_variant_groups_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_category_variant_groups_category_id ON public.menu_category_variant_groups USING btree (category_id);


--
-- Name: idx_menu_category_variant_groups_variant_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_category_variant_groups_variant_group_id ON public.menu_category_variant_groups USING btree (variant_group_id);


--
-- Name: idx_menu_item_reviews_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_item_reviews_customer_id ON public.menu_item_reviews USING btree (customer_id);


--
-- Name: idx_menu_item_reviews_menu_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_item_reviews_menu_item_id ON public.menu_item_reviews USING btree (menu_item_id);


--
-- Name: idx_menu_item_variants_menu_item_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_item_variants_menu_item_group ON public.menu_item_variants USING btree (menu_item_id, variant_group_id);


--
-- Name: idx_menu_item_variants_menu_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_item_variants_menu_item_id ON public.menu_item_variants USING btree (menu_item_id);


--
-- Name: idx_menu_items_display_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_items_display_order ON public.menu_items USING btree (category_id, display_order, id);


--
-- Name: idx_menu_items_not_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_items_not_deleted ON public.menu_items USING btree (is_deleted) WHERE (is_deleted = false);


--
-- Name: idx_notifications_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_customer ON public.notifications USING btree (customer_id, created_at DESC) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_notifications_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_staff ON public.notifications USING btree (staff_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_cashier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_cashier ON public.orders USING btree (cashier_id);


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_otp_contact_purpose; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_contact_purpose ON public.otp_verifications USING btree (contact, purpose);


--
-- Name: idx_payment_qr_codes_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_qr_codes_active ON public.payment_qr_codes USING btree (is_active, display_order, id);


--
-- Name: idx_payments_gcash_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_gcash_pending ON public.payments USING btree (status) WHERE ((status)::text = ANY (ARRAY[('awaiting_verification'::character varying)::text, ('rejected'::character varying)::text]));


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_rider_locations_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rider_locations_updated ON public.rider_locations USING btree (updated_at DESC);


--
-- Name: idx_riders_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_riders_email ON public.riders USING btree (email);


--
-- Name: idx_riders_mobile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_riders_mobile ON public.riders USING btree (mobile_number);


--
-- Name: idx_riders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_riders_status ON public.riders USING btree (status);


--
-- Name: idx_riders_work_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_riders_work_status ON public.riders USING btree (work_status);


--
-- Name: idx_sda_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sda_staff_id ON public.staff_dashboard_access USING btree (staff_id);


--
-- Name: idx_support_chat_messages_chat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_chat_messages_chat ON public.support_chat_messages USING btree (chat_id);


--
-- Name: idx_violations_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_violations_created ON public.customer_order_violations USING btree (created_at);


--
-- Name: idx_violations_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_violations_customer ON public.customer_order_violations USING btree (customer_id);


--
-- Name: pending_registrations_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pending_registrations_email_key ON public.pending_registrations USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: pending_registrations_mobile_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pending_registrations_mobile_key ON public.pending_registrations USING btree (mobile_number) WHERE (mobile_number IS NOT NULL);


--
-- Name: uq_menu_item_reviews_item_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_menu_item_reviews_item_customer ON public.menu_item_reviews USING btree (menu_item_id, customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: uq_menu_item_variants_item_group_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_menu_item_variants_item_group_name ON public.menu_item_variants USING btree (menu_item_id, variant_group_id, lower((name)::text)) WHERE (variant_group_id IS NOT NULL);


--
-- Name: uq_menu_item_variants_item_name_legacy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_menu_item_variants_item_name_legacy ON public.menu_item_variants USING btree (menu_item_id, name) WHERE (variant_group_id IS NULL);


--
-- Name: uq_variant_groups_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_variant_groups_name ON public.variant_groups USING btree (lower((name)::text));


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.staff_accounts(id);


--
-- Name: business_hours business_hours_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff_accounts(id) ON DELETE SET NULL;


--
-- Name: chatbot_conversations chatbot_conversations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: chatbot_messages chatbot_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE;


--
-- Name: customer_notifications customer_notifications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_notifications customer_notifications_related_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_related_order_id_fkey FOREIGN KEY (related_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: customer_order_violations customer_order_violations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_order_violations
    ADD CONSTRAINT customer_order_violations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_order_violations customer_order_violations_flagged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_order_violations
    ADD CONSTRAINT customer_order_violations_flagged_by_fkey FOREIGN KEY (flagged_by) REFERENCES public.staff_accounts(id);


--
-- Name: customer_order_violations customer_order_violations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_order_violations
    ADD CONSTRAINT customer_order_violations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: customer_restrictions customer_restrictions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_restrictions
    ADD CONSTRAINT customer_restrictions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_restrictions customer_restrictions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_restrictions
    ADD CONSTRAINT customer_restrictions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff_accounts(id);


--
-- Name: dashboard_switch_config dashboard_switch_config_configured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_switch_config
    ADD CONSTRAINT dashboard_switch_config_configured_by_fkey FOREIGN KEY (configured_by) REFERENCES public.staff_accounts(id);


--
-- Name: dashboard_switch_config dashboard_switch_config_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_switch_config
    ADD CONSTRAINT dashboard_switch_config_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff_accounts(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.staff_accounts(id);


--
-- Name: deliveries deliveries_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.delivery_batches(id) ON DELETE SET NULL;


--
-- Name: deliveries deliveries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.riders(id);


--
-- Name: delivery_batches delivery_batches_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_batches
    ADD CONSTRAINT delivery_batches_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.riders(id) ON DELETE CASCADE;


--
-- Name: esp32_wifi_configs esp32_wifi_configs_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esp32_wifi_configs
    ADD CONSTRAINT esp32_wifi_configs_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.esp32_devices(id) ON DELETE CASCADE;


--
-- Name: esp32_wifi_configs esp32_wifi_configs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esp32_wifi_configs
    ADD CONSTRAINT esp32_wifi_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff_accounts(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions fk_inventory_txn_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT fk_inventory_txn_order FOREIGN KEY (reference_order_id) REFERENCES public.orders(id);


--
-- Name: inventory_item_categories inventory_item_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_item_categories
    ADD CONSTRAINT inventory_item_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE CASCADE;


--
-- Name: inventory_item_categories inventory_item_categories_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_item_categories
    ADD CONSTRAINT inventory_item_categories_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_transactions inventory_transactions_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: inventory_transactions inventory_transactions_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.staff_accounts(id);


--
-- Name: kitchen_alerts kitchen_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_alerts
    ADD CONSTRAINT kitchen_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.staff_accounts(id);


--
-- Name: kitchen_alerts kitchen_alerts_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_alerts
    ADD CONSTRAINT kitchen_alerts_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.esp32_devices(id);


--
-- Name: kitchen_alerts kitchen_alerts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_alerts
    ADD CONSTRAINT kitchen_alerts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: menu_category_variant_groups menu_category_variant_groups_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_category_variant_groups
    ADD CONSTRAINT menu_category_variant_groups_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE CASCADE;


--
-- Name: menu_category_variant_groups menu_category_variant_groups_variant_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_category_variant_groups
    ADD CONSTRAINT menu_category_variant_groups_variant_group_id_fkey FOREIGN KEY (variant_group_id) REFERENCES public.variant_groups(id) ON DELETE CASCADE;


--
-- Name: menu_item_ingredients menu_item_ingredients_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_ingredients
    ADD CONSTRAINT menu_item_ingredients_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_ingredients menu_item_ingredients_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_ingredients
    ADD CONSTRAINT menu_item_ingredients_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_reviews menu_item_reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_reviews
    ADD CONSTRAINT menu_item_reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: menu_item_reviews menu_item_reviews_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_reviews
    ADD CONSTRAINT menu_item_reviews_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_variants menu_item_variants_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variants
    ADD CONSTRAINT menu_item_variants_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_variants menu_item_variants_variant_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variants
    ADD CONSTRAINT menu_item_variants_variant_group_id_fkey FOREIGN KEY (variant_group_id) REFERENCES public.variant_groups(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id);


--
-- Name: notifications notifications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff_accounts(id);


--
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.menu_item_variants(id) ON DELETE SET NULL;


--
-- Name: order_status_history order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.staff_accounts(id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.staff_accounts(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: payment_qr_codes payment_qr_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_qr_codes
    ADD CONSTRAINT payment_qr_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_accounts(id) ON DELETE SET NULL;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: payments payments_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.staff_accounts(id) ON DELETE SET NULL;


--
-- Name: rider_locations rider_locations_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rider_locations
    ADD CONSTRAINT rider_locations_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.riders(id) ON DELETE CASCADE;


--
-- Name: riders riders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riders
    ADD CONSTRAINT riders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_accounts(id);


--
-- Name: staff_accounts staff_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_accounts
    ADD CONSTRAINT staff_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_accounts(id);


--
-- Name: staff_dashboard_access staff_dashboard_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_dashboard_access
    ADD CONSTRAINT staff_dashboard_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.staff_accounts(id);


--
-- Name: staff_dashboard_access staff_dashboard_access_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_dashboard_access
    ADD CONSTRAINT staff_dashboard_access_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff_accounts(id) ON DELETE CASCADE;


--
-- Name: staff_switch_pin staff_switch_pin_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_switch_pin
    ADD CONSTRAINT staff_switch_pin_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff_accounts(id) ON DELETE CASCADE;


--
-- Name: support_chat_messages support_chat_messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chat_messages
    ADD CONSTRAINT support_chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.support_chats(id) ON DELETE CASCADE;


--
-- Name: support_chat_messages support_chat_messages_related_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chat_messages
    ADD CONSTRAINT support_chat_messages_related_order_id_fkey FOREIGN KEY (related_order_id) REFERENCES public.orders(id);


--
-- Name: support_chats support_chats_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- PostgreSQL database dump complete
--

\unrestrict PgdZ6teECf7XfW2jvCP7AJnZ3lQZrRgoO5H5cC3XtEBH6LwA23bepNgXIgEtUfl

