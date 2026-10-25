<?php
/*
  Temporary check: why does mail() fail on this server? Shows the PHP mail
  settings and the newest lines of the account's logs, with addresses and IPs
  hidden. Answers 404 without the right key. Removed again after use.
*/

declare(strict_types=1);

if (!hash_equals('85f90a4f7ad0528e4940e97449c38f0c29ca16bb108483aa6e9c31ba49cfb5ef', hash('sha256', (string) ($_GET['key'] ?? '')))) {
    http_response_code(404);
    exit;
}

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$hide = static fn (string $s): string => preg_replace(
    ['/[A-Za-z0-9._%+=-]+@(?=[A-Za-z0-9-]+\.)/', '/\b\d{1,3}(?:\.\d{1,3}){3}\b/', '/\[[0-9a-fA-F:.]+\]/'],
    ['…@', '#ip', '[#ip]'],
    $s,
);

function tail(string $file, int $count): array
{
    $handle = @fopen($file, 'rb');
    if (!$handle) {
        return ['(cannot read)'];
    }
    fseek($handle, max(0, (int) filesize($file) - 300000));
    $lines = explode("\n", rtrim((string) stream_get_contents($handle)));
    fclose($handle);
    return array_slice($lines, -$count);
}

echo 'PHP ' . PHP_VERSION . ' (' . PHP_SAPI . '), now ' . gmdate('H:i:s') . " UTC\n";
foreach (['sendmail_path', 'sendmail_from', 'mail.force_extra_parameters', 'mail.add_x_header', 'mail.log', 'error_log', 'disable_functions', 'open_basedir'] as $name) {
    echo $name . ': ' . var_export(ini_get($name), true) . "\n";
}
$home = getenv('HOME') ?: (preg_match('#^/home/[^/]+#', __DIR__, $m) ? $m[0] : '');
echo 'HOME: ' . $home . "\nscript: " . __DIR__ . "\n";

foreach (["$home/.logs", "$home/logs", dirname(__DIR__, 2) . '/logs'] as $dir) {
    $files = @scandir($dir);
    echo "\n== $dir: " . ($files ? implode(', ', array_diff($files, ['.', '..'])) : '(cannot list)') . "\n";
    foreach ($files ?: [] as $file) {
        if (is_file("$dir/$file") && preg_match('/exim|mail|error/i', $file)) {
            echo "\n-- $file (" . filesize("$dir/$file") . " bytes, changed " . gmdate('H:i:s', (int) filemtime("$dir/$file")) . " UTC)\n";
            foreach (tail("$dir/$file", 40) as $line) {
                echo $hide($line) . "\n";
            }
        }
    }
}
if (ini_get('error_log')) {
    echo "\n-- php error_log\n";
    foreach (tail((string) ini_get('error_log'), 20) as $line) {
        echo $hide($line) . "\n";
    }
}

// ?try=sendmail hands one short test email to the server's mail program directly,
// so its own error message shows instead of mail()'s bare false.
if (($_GET['try'] ?? '') === 'sendmail') {
    $process = function_exists('proc_open') ? @proc_open(ini_get('sendmail_path') . ' -finfo@originnorth.dk', [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes) : false;
    if (!is_resource($process)) {
        echo "\nproc_open unavailable\n";
        exit;
    }
    fwrite($pipes[0], "To: info@originnorth.dk\r\nFrom: info@originnorth.dk\r\nSubject: Website mail check\r\n\r\nA check from Claude while fixing the brief form. You can delete this email.\r\n");
    fclose($pipes[0]);
    $out = (string) stream_get_contents($pipes[1]);
    $err = (string) stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    echo "\nsendmail exit " . proc_close($process) . "\nstdout: " . $hide($out) . "\nstderr: " . $hide($err) . "\n";
}
