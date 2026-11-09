/**
 * Script do Google Ads → Painel da Bianca
 *
 * Onde instalar: Google Ads › Ferramentas › Ações em massa › Scripts › (+) Novo script.
 * Cole este código, troque INGEST_TOKEN pelo valor definido no Easypanel, clique em
 * "Autorizar", depois "Visualizar" para testar e, por fim, programe para rodar "A cada hora".
 *
 * O que ele faz: lê os números dos últimos 30 dias (campanhas, gastos, cliques, conversões,
 * cliques no WhatsApp do anúncio e principais pesquisas) e envia para o painel do site.
 * Nenhum dado pessoal de pacientes é coletado: são só métricas agregadas de anúncios.
 */

var PAINEL_URL = 'https://psibiancagoncalves.com.br/api/ads-ingest';
var INGEST_TOKEN = 'COLE_AQUI_O_INGEST_TOKEN';
var DAYS = 30;

function main() {
  var tz = AdsApp.currentAccount().getTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var start = Utilities.formatDate(new Date(Date.now() - (DAYS - 1) * 864e5), tz, 'yyyy-MM-dd');
  var start7 = Utilities.formatDate(new Date(Date.now() - 6 * 864e5), tz, 'yyyy-MM-dd');
  var between = "segments.date BETWEEN '" + start + "' AND '" + today + "'";

  var payload = {
    generatedAt: new Date().toISOString(),
    today: today,
    account: { name: AdsApp.currentAccount().getName(), currency: AdsApp.currentAccount().getCurrencyCode(), timeZone: tz },
    campaigns: [], daily: [], convByAction: [], clickTypes: [], searchTerms: []
  };

  var STATUS_PT = { PENDING: 'Em análise', NOT_ELIGIBLE: 'Não está veiculando', LIMITED: 'Veiculação limitada', ENDED: 'Encerrada', PAUSED: 'Pausada', LEARNING: 'Em aprendizado', MISCONFIGURED: 'Configuração com problema' };

  safe('campanhas', function () {
    var it = AdsApp.search(
      'SELECT campaign.id, campaign.name, campaign.status, campaign.primary_status, campaign_budget.amount_micros ' +
      "FROM campaign WHERE campaign.status != 'REMOVED'");
    while (it.hasNext()) {
      var r = it.next();
      payload.campaigns.push({
        id: String(r.campaign.id),
        name: r.campaign.name,
        status: r.campaign.status,
        primaryStatus: r.campaign.primaryStatus || null,
        servingIssue: r.campaign.status === 'ENABLED' ? (STATUS_PT[r.campaign.primaryStatus] || null) : null,
        budget: r.campaignBudget ? Number(r.campaignBudget.amountMicros || 0) / 1e6 : null
      });
    }
  });

  safe('diario', function () {
    var it = AdsApp.search(
      'SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
      'FROM campaign WHERE ' + between);
    while (it.hasNext()) {
      var r = it.next();
      payload.daily.push({
        date: r.segments.date, campaignId: String(r.campaign.id),
        impressions: Number(r.metrics.impressions || 0), clicks: Number(r.metrics.clicks || 0),
        cost: Number(r.metrics.costMicros || 0) / 1e6, conversions: Number(r.metrics.conversions || 0)
      });
    }
  });

  safe('conversoes', function () {
    var it = AdsApp.search(
      'SELECT campaign.id, segments.date, segments.conversion_action_name, metrics.all_conversions ' +
      'FROM campaign WHERE ' + between);
    while (it.hasNext()) {
      var r = it.next();
      var c = Number(r.metrics.allConversions || 0);
      if (c > 0) payload.convByAction.push({ date: r.segments.date, campaignId: String(r.campaign.id), action: r.segments.conversionActionName, conversions: c });
    }
  });

  safe('tiposDeClique', function () {
    var it = AdsApp.search(
      'SELECT campaign.id, segments.date, segments.click_type, metrics.clicks ' +
      'FROM campaign WHERE ' + between);
    while (it.hasNext()) {
      var r = it.next();
      var n = Number(r.metrics.clicks || 0);
      if (n > 0) payload.clickTypes.push({ date: r.segments.date, campaignId: String(r.campaign.id), type: r.segments.clickType, clicks: n });
    }
  });

  safe('pesquisas', function () {
    var it = AdsApp.search(
      'SELECT search_term_view.search_term, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions ' +
      "FROM search_term_view WHERE segments.date BETWEEN '" + start7 + "' AND '" + today + "' AND metrics.clicks > 0 " +
      'ORDER BY metrics.clicks DESC LIMIT 30');
    var agg = {};
    while (it.hasNext()) {
      var r = it.next();
      var t = r.searchTermView.searchTerm;
      var a = agg[t] || (agg[t] = { term: t, clicks: 0, impressions: 0, cost: 0, conversions: 0 });
      a.clicks += Number(r.metrics.clicks || 0); a.impressions += Number(r.metrics.impressions || 0);
      a.cost += Number(r.metrics.costMicros || 0) / 1e6; a.conversions += Number(r.metrics.conversions || 0);
    }
    payload.searchTerms = Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (x, y) { return y.clicks - x.clicks; });
  });

  var resp = UrlFetchApp.fetch(PAINEL_URL, {
    method: 'post', contentType: 'application/json', headers: { 'X-Token': INGEST_TOKEN },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  Logger.log('Painel respondeu ' + resp.getResponseCode() + ': ' + resp.getContentText());
  Logger.log(payload.campaigns.length + ' campanhas, ' + payload.daily.length + ' linhas diárias enviadas.');
}

function safe(label, fn) {
  try { fn(); } catch (e) { Logger.log('Aviso (' + label + '): ' + e); }
}
