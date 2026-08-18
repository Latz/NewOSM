<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WordPress stub definitions for unit tests.
 *
 * Every function here is a sensible no-op default. Brain Monkey patches over
 * any of them per-test when you call Functions\expect() or Functions\when().
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
if (!class_exists('WP_Error')) {
    class WP_Error
    {
        public array $errors     = [];
        public array $error_data = [];

        public function __construct(string $code = '', string $message = '', mixed $data = '')
        {
            if ($code !== '') {
                $this->errors[$code][]   = $message;
                $this->error_data[$code] = $data;
            }
        }

        public function get_error_code(): string
        {
            return (string) key($this->errors);
        }

        public function get_error_message(string $code = ''): string
        {
            $code = $code ?: $this->get_error_code();
            return $this->errors[$code][0] ?? '';
        }

        public function get_error_data(string $code = ''): mixed
        {
            $code = $code ?: $this->get_error_code();
            return $this->error_data[$code] ?? null;
        }
    }
}

if (!class_exists('WP_REST_Request')) {
    class WP_REST_Request implements ArrayAccess
    {
        protected array $params  = [];
        protected array $headers = [];

        public function get_param(string $key): mixed
        {
            return $this->params[$key] ?? null;
        }

        public function get_json_params(): array
        {
            return $this->params;
        }

        public function get_header(string $key): ?string
        {
            return $this->headers[strtolower($key)] ?? null;
        }

        public function set_header(string $key, string $value): void
        {
            $this->headers[strtolower($key)] = $value;
        }

        public function has_param(string $key): bool               { return isset($this->params[$key]); }
        public function offsetGet(mixed $key): mixed                { return $this->params[$key] ?? null; }
        public function offsetExists(mixed $key): bool              { return isset($this->params[$key]); }
        public function offsetSet(mixed $key, mixed $value): void   { $this->params[$key] = $value; }
        public function offsetUnset(mixed $key): void               { unset($this->params[$key]); }
    }
}

if (!class_exists('WP_REST_Response')) {
    class WP_REST_Response
    {
        public function __construct(
            public mixed $data   = null,
            public int   $status = 200
        ) {
        }

        public function get_data(): mixed { return $this->data; }
        public function get_status(): int { return $this->status; }
    }
}

// ---------------------------------------------------------------------------
// Hook functions — pure no-ops; tests use Brain\Monkey\Actions/Filters to assert
// ---------------------------------------------------------------------------
if (!function_exists('add_action')) {
    function add_action(string $hook, $cb, int $priority = 10, int $accepted_args = 1): void {
    }
}
if (!function_exists('add_filter')) {
    function add_filter(string $hook, $cb, int $priority = 10, int $accepted_args = 1): void {
    }
}
if (!function_exists('do_action')) {
    function do_action(string $hook_name, mixed ...$args): void {
    }
}
if (!function_exists('apply_filters')) {
    function apply_filters(string $hook_name, mixed $value, mixed ...$args): mixed { return $value; }
}

// ---------------------------------------------------------------------------
// i18n — return text unchanged so assertions read naturally
// ---------------------------------------------------------------------------
if (!function_exists('__')) {
    function __(string $t, string $d = 'default'): string { return $t; }
}
if (!function_exists('_e')) {
    function _e(string $t, string $d = 'default'): void { echo esc_html($t); }
}
if (!function_exists('esc_html__')) {
    function esc_html__(string $t, string $d = 'default'): string { return htmlspecialchars($t); } // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
if (!function_exists('esc_html_e')) {
    function esc_html_e(string $t, string $d = 'default'): void { echo htmlspecialchars($t); } // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
if (!function_exists('esc_attr_e')) {
    function esc_attr_e(string $t, string $d = 'default'): void { echo htmlspecialchars($t, ENT_QUOTES); } // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
if (!function_exists('load_plugin_textdomain')) {
    function load_plugin_textdomain(string $domain, bool $deprecated = false, string|false $path = false): bool { return true; }
}

// ---------------------------------------------------------------------------
// Output escaping — identity by default; override in tests that check escaping
// ---------------------------------------------------------------------------
if (!function_exists('esc_html')) {
    function esc_html(string $t): string { return htmlspecialchars($t, ENT_QUOTES); }
}
if (!function_exists('esc_attr')) {
    function esc_attr(int|string $t): string { return htmlspecialchars((string) $t, ENT_QUOTES); }
}
if (!function_exists('esc_url')) {
    function esc_url(string $u): string { return $u; }
}
if (!function_exists('esc_url_raw')) {
    function esc_url_raw(string $u): string { return $u; }
}
if (!function_exists('esc_js')) {
    function esc_js(string $t): string { return addslashes($t); }
}
if (!function_exists('wp_kses_post')) {
    function wp_kses_post(string $d): string { return $d; }
}
if (!function_exists('sanitize_text_field')) {
    function sanitize_text_field(string $s): string { return trim(wp_strip_all_tags($s)); }
}
if (!function_exists('wp_strip_all_tags')) {
    function wp_strip_all_tags(string $s, bool $remove_breaks = false): string {
        $s = preg_replace('@<(script|style)[^>]*?>.*?</\\1>@si', '', (string) $s);
        return (string) preg_replace('@<[^>]*>@', '', $s);
    }
}

// ---------------------------------------------------------------------------
// Plugin path/URL helpers
// ---------------------------------------------------------------------------
if (!function_exists('plugin_dir_path')) {
    function plugin_dir_path(string $file): string { return trailingslashit(dirname($file)); }
}
if (!function_exists('plugin_dir_url')) {
    function plugin_dir_url(string $file): string { return 'http://example.com/wp-content/plugins/' . basename(dirname($file)) . '/'; }
}
if (!function_exists('plugin_basename')) {
    function plugin_basename(string $file): string { return basename(dirname($file)) . '/' . basename($file); }
}
if (!function_exists('plugins_url')) {
    function plugins_url(string $path = '', string $plugin = ''): string {
        return 'http://example.com/wp-content/plugins/' . ltrim($path, '/');
    }
}
if (!function_exists('trailingslashit')) {
    function trailingslashit(string $s): string { return rtrim($s, '/\\') . '/'; }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
if (!function_exists('get_option')) {
    function get_option(string $option, mixed $default = false): mixed { return $default; }
}
if (!function_exists('update_option')) {
    function update_option(string $option, mixed $value, bool|string|null $autoload = null): bool { return true; }
}

// ---------------------------------------------------------------------------
// Admin / settings API
// ---------------------------------------------------------------------------
if (!function_exists('is_admin')) {
    function is_admin(): bool { return false; }
}
if (!function_exists('add_options_page')) {
    function add_options_page(string $page_title, string $menu_title, string $capability, string $menu_slug, $callback = ''): string|false { return $menu_slug; }
}
if (!function_exists('register_setting')) {
    function register_setting(string $option_group, string $option_name, array $args = []): void {
    }
}
if (!function_exists('add_settings_error')) {
    function add_settings_error(string $setting, string $code, string $message, string $type = 'error'): void {
    }
}
if (!function_exists('settings_errors')) {
    function settings_errors(string $setting = ''): void {
    }
}
if (!function_exists('settings_fields')) {
    function settings_fields(string $option_group): void {
    }
}
if (!function_exists('submit_button')) {
    function submit_button(string $text = 'Save Changes', string $type = 'primary', string $name = 'submit', bool $wrap = true): void {
    }
}
if (!function_exists('selected')) {
    function selected(mixed $selected, mixed $current = true, bool $echo = true): string {
        $result = ((string) $selected === (string) $current) ? ' selected="selected"' : '';
        if ($echo) {
            echo $result;
        }
        return $result;
    }
}
if (!function_exists('get_admin_page_title')) {
    function get_admin_page_title(): string { return ''; }
}
if (!function_exists('current_user_can')) {
    function current_user_can(string $capability, mixed ...$args): bool { return false; }
}
if (!function_exists('is_wp_error')) {
    function is_wp_error(mixed $thing): bool { return $thing instanceof WP_Error; }
}

// ---------------------------------------------------------------------------
// Assets / blocks / REST
// ---------------------------------------------------------------------------
if (!function_exists('wp_enqueue_script')) {
    function wp_enqueue_script(string $handle, string $src = '', array $deps = [], mixed $ver = false, mixed $args = []): void {
    }
}
if (!function_exists('wp_register_script')) {
    function wp_register_script(string $handle, string $src = '', array $deps = [], mixed $ver = false, mixed $args = []): bool { return true; }
}
if (!function_exists('wp_enqueue_style')) {
    function wp_enqueue_style(string $handle, string $src = '', array $deps = [], mixed $ver = false, string $media = 'all'): void {
    }
}
if (!function_exists('wp_localize_script')) {
    function wp_localize_script(string $handle, string $object_name, array $l10n): bool { return true; }
}
if (!function_exists('wp_set_script_translations')) {
    function wp_set_script_translations(string $handle, string $domain = 'default', string $path = ''): bool { return true; }
}
if (!function_exists('has_block')) {
    function has_block(string $block_name, mixed $post = null): bool { return false; }
}
if (!function_exists('register_block_type')) {
    function register_block_type(string $block_type, array $args = []): mixed { return null; }
}
if (!function_exists('register_rest_route')) {
    function register_rest_route(string $namespace, string $route, array $args = [], bool $override = false): bool { return true; }
}
if (!function_exists('rest_ensure_response')) {
    function rest_ensure_response(mixed $data): mixed { return $data; }
}
if (!function_exists('wp_parse_args')) {
    function wp_parse_args(mixed $args, mixed $defaults = []): array {
        if (is_object($args)) {
            $args = get_object_vars($args);
        } elseif (!is_array($args)) {
            parse_str((string) $args, $args);
        }
        return array_merge((array) $defaults, (array) $args);
    }
}
