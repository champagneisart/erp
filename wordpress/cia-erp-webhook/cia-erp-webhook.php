<?php
/**
 * Plugin Name: CIA ERP Webhook
 * Description: Stuurt Avada-formulieren door naar Champagne is Art Studio ERP.
 * Version: 1.4.0
 * Author: Champagne is Art Studio
 */

if (!defined('ABSPATH')) {
  exit;
}

define('CIA_ERP_WEBHOOK_OPTION_URL', 'cia_erp_webhook_url');
define('CIA_ERP_WEBHOOK_OPTION_SECRET', 'cia_erp_webhook_secret');
define('CIA_ERP_WEBHOOK_OPTION_LOG', 'cia_erp_webhook_log');
define('CIA_ERP_LOG_MAX', 20);

function cia_erp_get_webhook_url(): string {
  $saved = get_option(CIA_ERP_WEBHOOK_OPTION_URL, '');
  if ($saved) {
    return rtrim($saved, '/');
  }
  return 'https://erp-gamma-peach.vercel.app/api/webhooks/forms';
}

function cia_erp_get_webhook_secret(): string {
  return (string) get_option(CIA_ERP_WEBHOOK_OPTION_SECRET, '');
}

function cia_erp_get_log(): array {
  $log = get_option(CIA_ERP_WEBHOOK_OPTION_LOG, []);
  return is_array($log) ? $log : [];
}

/** @param array{ok:bool,source:string,message:string,http_code?:int,form_id?:string,form_name?:string,detail?:string} $entry */
function cia_erp_add_log(array $entry): void {
  $log = cia_erp_get_log();
  array_unshift($log, array_merge([
    'at' => gmdate('c'),
    'ok' => false,
    'source' => 'unknown',
    'message' => '',
    'http_code' => 0,
    'form_id' => '',
    'form_name' => '',
    'detail' => '',
  ], $entry));
  update_option(CIA_ERP_WEBHOOK_OPTION_LOG, array_slice($log, 0, CIA_ERP_LOG_MAX));
}

function cia_erp_flatten_fields($input): array {
  $out = [];

  $walk = function ($value, $prefix = '') use (&$walk, &$out): void {
    if (!is_array($value)) {
      if ($prefix !== '' && $value !== null && $value !== '') {
        $out[$prefix] = is_scalar($value) ? (string) $value : wp_json_encode($value);
      }
      return;
    }

    foreach ($value as $key => $child) {
      $key = (string) $key;
      $path = $prefix === '' ? $key : $prefix . '_' . $key;
      if (is_array($child)) {
        $walk($child, $path);
      } elseif ($child !== null && $child !== '') {
        $out[$path] = is_scalar($child) ? (string) $child : wp_json_encode($child);
      }
    }
  };

  $walk($input);
  return $out;
}

function cia_erp_extract_payload($raw, $form_post_id = 0): array {
  $fields = [];

  if (is_array($raw)) {
    if (isset($raw['data']) && is_array($raw['data'])) {
      $fields = cia_erp_flatten_fields($raw['data']);
    } else {
      $fields = cia_erp_flatten_fields($raw);
    }

    if (isset($raw['submission']) && is_array($raw['submission'])) {
      $fields = array_merge($fields, cia_erp_flatten_fields($raw['submission']));
    }
  }

  $form_id = (string) (
    $fields['form_id']
    ?? (is_array($raw) ? ($raw['form_id'] ?? '') : '')
    ?? $form_post_id
  );

  $form_name = (string) (
    $fields['form_name']
    ?? (is_array($raw) ? ($raw['form_name'] ?? '') : '')
    ?? ($form_post_id ? get_the_title((int) $form_post_id) : '')
  );

  return array_merge($fields, [
    'form_id' => $form_id,
    'form_name' => $form_name,
  ]);
}

function cia_erp_explain_http_error(int $code, string $body): string {
  if ($code === 401) {
    return 'Secret klopt niet — check WEBHOOK_SECRET in Vercel én in deze plugin (exact hetzelfde).';
  }
  if ($code === 503) {
    return 'WEBHOOK_SECRET ontbreekt in Vercel — voeg toe en redeploy.';
  }
  if ($code === 0) {
    return 'Geen verbinding — check URL, DNS of firewall op de server.';
  }
  if ($code >= 500) {
    return 'ERP-serverfout — check Vercel logs.';
  }
  if ($body !== '') {
    return wp_trim_words($body, 25, '…');
  }
  return 'Onbekende fout (HTTP ' . $code . ')';
}

/**
 * @return array{ok:bool,http_code:int,body:string,message:string,url:string,detail:string}
 */
function cia_erp_request_erp(array $payload, ?string $url = null, ?string $secret = null): array {
  $url = $url ? rtrim($url, '/') : cia_erp_get_webhook_url();
  $secret = $secret ?? cia_erp_get_webhook_secret();

  if (!$secret) {
    return [
      'ok' => false,
      'http_code' => 0,
      'body' => '',
      'message' => 'Secret niet ingevuld in plugin-instellingen',
      'url' => $url,
      'detail' => 'Vul het webhook secret in en sla op, of test opnieuw.',
    ];
  }

  if (!$url) {
    return [
      'ok' => false,
      'http_code' => 0,
      'body' => '',
      'message' => 'Webhook URL ontbreekt',
      'url' => '',
      'detail' => 'Vul de ERP-URL in (zonder ?secret=).',
    ];
  }

  $response = wp_remote_post($url, [
    'timeout' => 20,
    'headers' => [
      'Content-Type'  => 'application/json',
      'Authorization' => 'Bearer ' . $secret,
    ],
    'body' => wp_json_encode($payload),
  ]);

  if (is_wp_error($response)) {
    return [
      'ok' => false,
      'http_code' => 0,
      'body' => '',
      'message' => 'Verbinding mislukt: ' . $response->get_error_message(),
      'url' => $url,
      'detail' => 'WordPress kan Vercel niet bereiken. Hosting/firewall blokkeert mogelijk uitgaande requests.',
    ];
  }

  $code = (int) wp_remote_retrieve_response_code($response);
  $body = (string) wp_remote_retrieve_body($response);
  $ok = $code >= 200 && $code < 300;

  return [
    'ok' => $ok,
    'http_code' => $code,
    'body' => $body,
    'message' => $ok ? 'Doorgestuurd naar ERP (HTTP ' . $code . ')' : cia_erp_explain_http_error($code, $body),
    'url' => $url,
    'detail' => $ok ? ($body !== '' ? wp_trim_words($body, 20, '…') : '') : cia_erp_explain_http_error($code, $body),
  ];
}

function cia_erp_send_form_to_erp(array $payload, string $source = 'hook'): bool {
  $result = cia_erp_request_erp($payload);

  cia_erp_add_log([
    'ok' => $result['ok'],
    'source' => $source,
    'message' => $result['message'],
    'http_code' => $result['http_code'],
    'form_id' => (string) ($payload['form_id'] ?? ''),
    'form_name' => (string) ($payload['form_name'] ?? ''),
    'detail' => $result['detail'],
  ]);

  if (!$result['ok']) {
    error_log('[CIA ERP] [' . $source . '] ' . $result['message']);
  }

  return $result['ok'];
}

function cia_erp_custom_form_action($data = [], $id = 0): array {
  $payload = cia_erp_extract_payload($data, (int) $id);
  $ok = cia_erp_send_form_to_erp($payload, 'avada_action');

  if (!$ok) {
    return [
      'status' => 'error',
      'info' => 'ERP webhook mislukt — zie WordPress → Instellingen → CIA ERP Webhook → logboek.',
    ];
  }

  return [
    'status' => 'success',
    'info' => 'Formulier doorgestuurd naar ERP.',
  ];
}

add_filter('awb_custom_form_actions', function ($actions = []) {
  $actions['cia_erp'] = [
    'label' => 'CIA ERP Webhook',
    'callback' => 'cia_erp_custom_form_action',
  ];
  return $actions;
});

function cia_erp_on_fusion_form_submission_data($form_data, $form_post_id): void {
  cia_erp_send_form_to_erp(cia_erp_extract_payload($form_data, (int) $form_post_id), 'php_hook');
}

add_action('fusion_form_submission_data', 'cia_erp_on_fusion_form_submission_data', 10, 2);

add_action('wp_enqueue_scripts', function () {
  wp_register_script('cia-erp-webhook', false, ['jquery'], '1.4.0', true);
  wp_enqueue_script('cia-erp-webhook');
  wp_add_inline_script('cia-erp-webhook', "
    jQuery(window).on('fusion-form-ajax-submit-done', function(_ev, formObj) {
      if (!formObj || !formObj.result || formObj.result.status !== 'success') return;
      jQuery.post('" . esc_url(admin_url('admin-ajax.php')) . "', {
        action: 'cia_erp_forward_submission',
        nonce: '" . esc_js(wp_create_nonce('cia_erp_forward')) . "',
        payload: JSON.stringify(formObj)
      });
    });
  ");
});

add_action('wp_ajax_cia_erp_forward_submission', 'cia_erp_ajax_forward');
add_action('wp_ajax_nopriv_cia_erp_forward_submission', 'cia_erp_ajax_forward');

function cia_erp_ajax_forward(): void {
  check_ajax_referer('cia_erp_forward', 'nonce');

  $raw = isset($_POST['payload']) ? json_decode(stripslashes((string) $_POST['payload']), true) : [];
  if (!is_array($raw)) {
    cia_erp_add_log([
      'ok' => false,
      'source' => 'js_fallback',
      'message' => 'Ongeldige payload van Avada-formulier',
      'detail' => 'JS fallback kreeg geen geldige JSON.',
    ]);
    wp_send_json_error(['message' => 'Invalid payload'], 400);
  }

  $form_id = (string) ($raw['formConfig']['form_id'] ?? $raw['formConfig']['id'] ?? '');
  $form_name = (string) ($raw['formConfig']['form_name'] ?? $raw['formConfig']['title'] ?? '');
  $fields = is_array($raw['data'] ?? null) ? cia_erp_flatten_fields($raw['data']) : [];

  $payload = array_merge($fields, [
    'form_id' => $form_id,
    'form_name' => $form_name,
    'source' => 'js_fallback',
  ]);

  $ok = cia_erp_send_form_to_erp($payload, 'js_fallback');
  if ($ok) {
    wp_send_json_success(['message' => 'Forwarded']);
  }
  wp_send_json_error(['message' => 'ERP forward failed'], 502);
}

add_action('wp_ajax_cia_erp_admin_test', 'cia_erp_admin_test');

function cia_erp_admin_test(): void {
  check_ajax_referer('cia_erp_admin_test', 'nonce');

  if (!current_user_can('manage_options')) {
    wp_send_json_error(['message' => 'Geen toegang'], 403);
  }

  $url = isset($_POST['url']) ? esc_url_raw(wp_unslash((string) $_POST['url'])) : cia_erp_get_webhook_url();
  $secret = isset($_POST['secret']) && $_POST['secret'] !== ''
    ? sanitize_text_field(wp_unslash((string) $_POST['secret']))
    : cia_erp_get_webhook_secret();

  $payload = [
    'form_id' => 'plugin_test',
    'form_name' => 'CIA ERP plugin test',
    'voornaam' => 'Plugin',
    'email' => 'test@example.com',
    'source' => 'admin_test',
  ];

  $result = cia_erp_request_erp($payload, $url ?: null, $secret ?: null);

  cia_erp_add_log([
    'ok' => $result['ok'],
    'source' => 'admin_test',
    'message' => $result['message'],
    'http_code' => $result['http_code'],
    'form_id' => 'plugin_test',
    'form_name' => 'CIA ERP plugin test',
    'detail' => $result['detail'],
  ]);

  $decoded = json_decode($result['body'], true);

  if ($result['ok']) {
    wp_send_json_success([
      'message' => $result['message'],
      'http_code' => $result['http_code'],
      'url' => $result['url'],
      'capture_id' => is_array($decoded) ? ($decoded['captureId'] ?? null) : null,
      'erp_response' => $decoded ?: $result['body'],
      'detail' => 'Test gelukt — check ERP → Instellingen → Avada webhook.',
    ]);
  }

  wp_send_json_error([
    'message' => $result['message'],
    'http_code' => $result['http_code'],
    'url' => $result['url'],
    'detail' => $result['detail'],
    'erp_response' => $decoded ?: $result['body'],
  ], $result['http_code'] ?: 502);
}

add_action('admin_menu', function () {
  add_options_page(
    'CIA ERP Webhook',
    'CIA ERP Webhook',
    'manage_options',
    'cia-erp-webhook',
    'cia_erp_settings_page'
  );
});

add_action('admin_init', function () {
  register_setting('cia_erp_webhook', CIA_ERP_WEBHOOK_OPTION_URL);
  register_setting('cia_erp_webhook', CIA_ERP_WEBHOOK_OPTION_SECRET);

  if (
    isset($_GET['page'], $_GET['cia_erp_clear_log'])
    && $_GET['page'] === 'cia-erp-webhook'
    && current_user_can('manage_options')
    && check_admin_referer('cia_erp_clear_log')
  ) {
    delete_option(CIA_ERP_WEBHOOK_OPTION_LOG);
    wp_safe_redirect(admin_url('options-general.php?page=cia-erp-webhook&log_cleared=1'));
    exit;
  }
});

function cia_erp_source_label(string $source): string {
  $labels = [
    'admin_test' => 'Plugin-test',
    'avada_action' => 'Avada actie',
    'php_hook' => 'PHP-hook',
    'js_fallback' => 'JS-fallback',
  ];
  return $labels[$source] ?? $source;
}

add_action('admin_enqueue_scripts', function ($hook): void {
  if ($hook !== 'settings_page_cia-erp-webhook') {
    return;
  }

  wp_register_script('cia-erp-admin', false, ['jquery'], '1.4.0', true);
  wp_enqueue_script('cia-erp-admin');
  wp_add_inline_script('cia-erp-admin', "
    jQuery(function($) {
      $('#cia-erp-run-test').on('click', function() {
        var \$btn = $(this);
        var \$out = $('#cia-erp-test-result');
        \$btn.prop('disabled', true).text('Bezig…');
        \$out.removeClass('success error').hide().empty();

        $.post(ajaxurl, {
          action: 'cia_erp_admin_test',
          nonce: '" . esc_js(wp_create_nonce('cia_erp_admin_test')) . "',
          url: $('input[name=\"' + '" . esc_js(CIA_ERP_WEBHOOK_OPTION_URL) . "' + '\"]').val(),
          secret: $('input[name=\"' + '" . esc_js(CIA_ERP_WEBHOOK_OPTION_SECRET) . "' + '\"]').val()
        }).done(function(res) {
          var d = res.data || {};
          var html = '<p><strong>✓ ' + (d.message || 'OK') + '</strong></p>';
          if (d.detail) html += '<p>' + d.detail + '</p>';
          if (d.capture_id) html += '<p>Capture ID: <code>' + d.capture_id + '</code></p>';
          html += '<pre style=\"white-space:pre-wrap;margin:0;font-size:11px\">' + JSON.stringify(d.erp_response || {}, null, 2) + '</pre>';
          \$out.addClass('success').html(html).show();
          setTimeout(function(){ location.reload(); }, 1500);
        }).fail(function(xhr) {
          var d = (xhr.responseJSON && xhr.responseJSON.data) ? xhr.responseJSON.data : {};
          var html = '<p><strong>✗ ' + (d.message || 'Test mislukt') + '</strong></p>';
          if (d.detail) html += '<p>' + d.detail + '</p>';
          if (d.http_code) html += '<p>HTTP ' + d.http_code + '</p>';
          if (d.erp_response) html += '<pre style=\"white-space:pre-wrap;margin:0;font-size:11px\">' + JSON.stringify(d.erp_response, null, 2) + '</pre>';
          \$out.addClass('error').html(html).show();
          setTimeout(function(){ location.reload(); }, 2000);
        }).always(function() {
          \$btn.prop('disabled', false).text('Test ERP-verbinding');
        });
      });
    });
  ");
});

function cia_erp_settings_page(): void {
  if (!current_user_can('manage_options')) {
    return;
  }

  if (isset($_GET['log_cleared'])) {
    echo '<div class="notice notice-success is-dismissible"><p>Logboek gewist.</p></div>';
  }

  $log = cia_erp_get_log();
  $last = $log[0] ?? null;
  $clear_url = wp_nonce_url(
    admin_url('options-general.php?page=cia-erp-webhook&cia_erp_clear_log=1'),
    'cia_erp_clear_log'
  );
  ?>
  <div class="wrap">
    <h1>CIA ERP Webhook <small style="font-weight:normal">v1.4.0</small></h1>

    <?php if ($last) : ?>
      <div class="notice <?php echo !empty($last['ok']) ? 'notice-success' : 'notice-error'; ?> inline">
        <p>
          <strong>Laatste poging (<?php echo esc_html(cia_erp_source_label((string) ($last['source'] ?? ''))); ?>):</strong>
          <?php echo esc_html((string) ($last['message'] ?? '')); ?>
          <?php if (!empty($last['form_name'])) : ?>
            — <?php echo esc_html((string) $last['form_name']); ?>
          <?php endif; ?>
        </p>
        <?php if (!empty($last['detail'])) : ?>
          <p style="margin-top:4px"><?php echo esc_html((string) $last['detail']); ?></p>
        <?php endif; ?>
      </div>
    <?php else : ?>
      <div class="notice notice-warning inline">
        <p>Nog geen activiteit — klik op <strong>Test ERP-verbinding</strong> of dien een formulier in.</p>
      </div>
    <?php endif; ?>

    <form method="post" action="options.php">
      <?php settings_fields('cia_erp_webhook'); ?>
      <table class="form-table">
        <tr>
          <th>Webhook URL</th>
          <td>
            <input type="url" name="<?php echo esc_attr(CIA_ERP_WEBHOOK_OPTION_URL); ?>"
              value="<?php echo esc_attr(get_option(CIA_ERP_WEBHOOK_OPTION_URL, cia_erp_get_webhook_url())); ?>"
              class="regular-text" />
            <p class="description">Zonder <code>?secret=</code></p>
          </td>
        </tr>
        <tr>
          <th>Webhook secret</th>
          <td>
            <input type="password" name="<?php echo esc_attr(CIA_ERP_WEBHOOK_OPTION_SECRET); ?>"
              value="<?php echo esc_attr(get_option(CIA_ERP_WEBHOOK_OPTION_SECRET, '')); ?>"
              class="regular-text" autocomplete="new-password" />
            <p class="description">Zelfde als WEBHOOK_SECRET in Vercel.</p>
          </td>
        </tr>
      </table>
      <?php submit_button('Instellingen opslaan'); ?>
    </form>

    <div class="card" style="max-width:820px;padding:16px;margin:20px 0">
      <h2 style="margin-top:0">Test ERP-verbinding</h2>
      <p>Test of WordPress het ERP kan bereiken met bovenstaande URL en secret.</p>
      <p><button type="button" class="button button-primary" id="cia-erp-run-test">Test ERP-verbinding</button></p>
      <div id="cia-erp-test-result" style="display:none;padding:12px;border-left:4px solid #ccc;background:#f6f7f7;margin-top:12px"></div>
      <style>
        #cia-erp-test-result.success { border-color: #00a32a; }
        #cia-erp-test-result.error { border-color: #d63638; }
      </style>
    </div>

    <div class="card" style="max-width:820px;padding:16px;margin:20px 0">
      <h2 style="margin-top:0">Logboek (laatste <?php echo (int) CIA_ERP_LOG_MAX; ?>)</h2>
      <p class="description">Elke doorstuur-poging — test, Avada-actie, PHP-hook of JS-fallback.</p>
      <?php if (empty($log)) : ?>
        <p><em>Nog geen entries.</em></p>
      <?php else : ?>
        <table class="widefat striped" style="margin-top:12px">
          <thead>
            <tr>
              <th>Tijd</th>
              <th>Status</th>
              <th>Bron</th>
              <th>Formulier</th>
              <th>Melding</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($log as $row) : ?>
              <tr>
                <td style="white-space:nowrap"><?php echo esc_html((string) ($row['at'] ?? '')); ?></td>
                <td><?php echo !empty($row['ok']) ? '<span style="color:#00a32a">✓ OK</span>' : '<span style="color:#d63638">✗ Fout</span>'; ?></td>
                <td><?php echo esc_html(cia_erp_source_label((string) ($row['source'] ?? ''))); ?></td>
                <td>
                  <?php
                  $fn = (string) ($row['form_name'] ?? '');
                  $fid = (string) ($row['form_id'] ?? '');
                  echo esc_html($fn !== '' ? $fn : ($fid !== '' ? '#' . $fid : '—'));
                  ?>
                </td>
                <td>
                  <?php echo esc_html((string) ($row['message'] ?? '')); ?>
                  <?php if (!empty($row['http_code'])) : ?>
                    <br><small>HTTP <?php echo (int) $row['http_code']; ?></small>
                  <?php endif; ?>
                  <?php if (!empty($row['detail'])) : ?>
                    <br><small><?php echo esc_html((string) $row['detail']); ?></small>
                  <?php endif; ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
        <p style="margin-top:12px"><a href="<?php echo esc_url($clear_url); ?>" class="button">Logboek wissen</a></p>
      <?php endif; ?>
    </div>

    <h2>Avada per formulier</h2>
    <ol>
      <li>Submission → <strong>AJAX</strong></li>
      <li>Actions: database + mail + <strong>CIA ERP Webhook</strong></li>
      <li>Send To URL <strong>uit</strong></li>
      <li>Na submit: check logboek — bron moet <em>Avada actie</em> of <em>JS-fallback</em> zijn</li>
    </ol>
    <p class="description">
      <strong>Geen log-entry na formulier?</strong> Avada stuurt niet — actie ontbreekt of submit faalt lokaal.<br>
      <strong>HTTP 401?</strong> Secret fixen. <strong>Verbinding mislukt?</strong> Hosting blokkeert uitgaand verkeer.
    </p>
  </div>
  <?php
}
