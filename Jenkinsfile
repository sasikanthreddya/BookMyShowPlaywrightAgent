// Jenkins pipeline for the BookMyShow Playwright BDD suite.
//
// Mirrors .github/workflows/e2e.yml: a browserless flow-drift gate first, then
// the tests. Three suites, narrowed by two dropdowns:
//   SUITE=smoke       @smoke only, anonymous project, no credentials (default)
//   SUITE=regression  everything except @account, anonymous project
//   SUITE=full        regression + the signed-in @account scenarios (nightly
//                     timer, or by hand); needs the bms-google credential
//   SERVICE / TAG     optional AND-filters (e.g. movies + @filters). smoke
//                     ignores TAG because it IS a tag. GREP is a raw
//                     Playwright --grep regex for anything the dropdowns
//                     cannot say, and overrides both.
// Read "Running in CI" in README.md before changing anything here - every
// odd-looking choice below is measured against the live site, not a style
// preference.
//
// Agent requirements (the pipeline does NOT install these):
//   * Node 20+ on PATH.
//   * Real Google Chrome (playwright.config.ts pins channel: "chrome"; bundled
//     Chromium is blocked by Cloudflare). Tick INSTALL_CHROME once to let
//     Playwright install it - needs root/admin on the agent.
//   * A display. The suite MUST run headed (Cloudflare blocks headless):
//       Linux   -> xvfb is used automatically (apt install xvfb).
//       Windows -> run the agent from a logged-in desktop session, e.g.
//                  `java -jar agent.jar ...` in a terminal, NOT as a Windows
//                  service. A service lives in session 0 with no desktop and
//                  Chrome either fails to start or is treated as headless.
//   * For SUITE=full: a "Username with password" credential with id
//     `bms-google` (username = Google email, password = Google password).
//     Only the "setup" project reads it; @account scenarios then reuse the
//     session it saves under .auth/, which is gitignored and workspace-local.

// Named `shell`, not `run`: `run` is an existing pipeline step name and the
// declarative linter rejects a bare `run '...'` in a steps block.
def shell(String cmd) {
  if (isUnix()) { sh cmd } else { bat cmd }
}

// Wrap a browser-driving command in a virtual display on Linux. Windows agents
// are expected to have a real desktop (see header).
def headed(String cmd) {
  return isUnix() ? "xvfb-run -a ${cmd}" : cmd
}

// Nightly timer runs everything; anything else honours the SUITE parameter.
def effectiveSuite() {
  def timer = currentBuild.getBuildCauses('hudson.triggers.TimerTrigger$TimerTriggerCause')
  return timer ? 'full' : params.SUITE
}

// Build the --grep regex from the dropdowns. Playwright takes ONE regex, so
// two tags are ANDed with lookaheads: (?=.*@movies)(?=.*@filters). Parameters
// can be null on the first build after this file adds one, hence the ?: falls.
def grepArg() {
  def raw = (params.GREP ?: '').trim()
  if (raw) { return "--grep \"${raw}\"" }
  def parts = []
  def service = (params.SERVICE ?: 'all')
  def tag = effectiveSuite() == 'smoke' ? '@smoke' : (params.TAG ?: 'all')
  if (service != 'all') { parts << "@${service}" }
  if (tag != 'all')     { parts << tag }
  if (parts.isEmpty()) { return '' }
  if (parts.size() == 1) { return "--grep \"${parts[0]}\"" }
  return "--grep \"" + parts.collect { "(?=.*${it})" }.join('') + "\""
}

pipeline {
  agent any

  options {
    // Live production site with workers: 1 - two runs at once double the
    // bot-detection exposure. Abort the older run rather than queue.
    disableConcurrentBuilds(abortPrevious: true)
    timeout(time: 120, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '15'))
  }

  parameters {
    choice(name: 'SUITE', choices: ['smoke', 'regression', 'full'],
      description: 'smoke: one happy path per service, no login. regression: every scenario except the signed-in ones. full: regression plus the signed-in @account scenarios - needs the bms-google credential.')
    choice(name: 'SERVICE', choices: ['all', 'movies', 'events', 'plays', 'activities', 'sports', 'stream'],
      description: 'Limit the run to one service. Applies to every SUITE.')
    choice(name: 'TAG', choices: ['all', '@filters', '@booking', '@city', '@search', '@details', '@auth', '@cinemas', '@venues', '@browse', '@sporttype'],
      description: 'Limit regression/full to one kind of scenario. ANDed with SERVICE. Ignored for smoke. (@account is not listed: SUITE=full is how the signed-in scenarios run.)')
    string(name: 'GREP', defaultValue: '',
      description: 'Advanced: raw Playwright --grep regex, e.g. @movies|@events. Overrides SERVICE and TAG.')
    booleanParam(name: 'INSTALL_CHROME', defaultValue: false,
      description: 'Run `npx playwright install --with-deps chrome` first. Needs root/admin; only for a fresh agent.')
  }

  triggers {
    // Nightly full run, 01:30 UTC (07:00 IST) - same slot as the GitHub workflow.
    cron('TZ=UTC\n30 1 * * *')
  }

  environment {
    CI = 'true'
    NPM_CONFIG_AUDIT = 'false'
    NPM_CONFIG_FUND = 'false'
    // A CI workspace never has a session worth reusing, and nobody is watching
    // to finish a 2FA prompt: fail fast instead of hanging.
    BMS_AUTH_MAX_AGE_HOURS = '0'
    BMS_AUTH_WAIT_MINUTES = '0'
  }

  stages {
    stage('Install') {
      steps {
        script {
          shell 'node --version'
          shell 'npm install'
        }
      }
    }

    // Browserless and quick. Catches the failure the suite cannot: a feature
    // that silently fell behind its flow. Runs before any browser is opened.
    stage('Flow drift') {
      steps { script { shell 'npm run flows:check' } }
    }

    stage('Install Chrome') {
      when { expression { params.INSTALL_CHROME } }
      steps {
        script {
          shell(isUnix() ? 'npx playwright install --with-deps chrome' : 'npx playwright install chrome')
        }
      }
    }

    stage('Generate specs') {
      steps { script { shell 'npx bddgen' } }
    }

    // smoke and regression both run logged out; smoke is regression with TAG
    // forced to @smoke (see grepArg).
    stage('Tests (anonymous)') {
      when { expression { effectiveSuite() != 'full' } }
      steps {
        script {
          echo "SUITE=${effectiveSuite()} SERVICE=${params.SERVICE ?: 'all'} TAG=${params.TAG ?: 'all'} -> ${grepArg() ?: '(no filter)'}"
          shell headed("npx playwright test --project=anonymous ${grepArg()}")
        }
      }
    }

    // No --project: runs setup (sign in), anonymous and account. Playwright
    // exits non-zero if a filter matches nothing, so a too-narrow SERVICE+TAG
    // fails loudly rather than passing on zero tests.
    stage('Tests (full, signed in)') {
      when { expression { effectiveSuite() == 'full' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'bms-google',
                                          usernameVariable: 'BMS_GOOGLE_EMAIL',
                                          passwordVariable: 'BMS_GOOGLE_PASSWORD')]) {
          script {
            echo "SUITE=full SERVICE=${params.SERVICE ?: 'all'} TAG=${params.TAG ?: 'all'} -> ${grepArg() ?: '(no filter)'}"
            shell headed("npx playwright test ${grepArg()}")
          }
        }
      }
    }
  }

  post {
    always {
      // reports/junit.xml comes from the junit reporter in playwright.config.ts.
      junit testResults: 'reports/junit.xml', allowEmptyResults: true
      archiveArtifacts artifacts: 'reports/**, test-results/**', allowEmptyArchive: true, fingerprint: false
      script {
        // HTML Publisher plugin is optional; skip quietly if it is missing or broken.
        try {
          publishHTML(target: [
            reportName: 'Playwright report',
            reportDir: 'reports/html',
            reportFiles: 'index.html',
            keepAll: true,
            alwaysLinkToLastBuild: true,
            allowMissing: true,
          ])
        } catch (Throwable e) {
          // Missing plugin surfaces as NoSuchMethodError; a plugin whose own
          // dependencies are broken (seen: htmlpublisher 427.1 on Jenkins 2.582,
          // NoClassDefFoundError for commons-lang) surfaces as
          // IllegalArgumentException. Neither should fail a green test run.
          echo "HTML report not published (${e}). Open reports/html/index.html from the archived artifacts instead."
        }
      }
    }
  }
}
