(() => {
  const form = document.querySelector('#tess-roi-form');
  if (!form) return;
  const byId = id => document.getElementById(id);
  const number = value => new Intl.NumberFormat('en-GB', {maximumFractionDigits: 0}).format(Math.max(0, value));
  const money = value => new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP', maximumFractionDigits: 0}).format(value);

  function calculate() {
    const inputs = [...form.querySelectorAll('input')];
    const valid = inputs.every(input => input.validity.valid && input.value !== '' && Number.isFinite(input.valueAsNumber));
    byId('tess-roi-error').hidden = valid;
    if (!valid) {
      ['tess-participation', 'tess-engagement', 'tess-capacity', 'tess-net'].forEach(id => byId(id).textContent = 'Check inputs');
      byId('tess-return').textContent = 'Enter valid assumptions to update the model.';
      byId('tess-payback').textContent = '';
      return;
    }
    const values = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)]));
    const sessionsPerYear = values.devices * values.sessions * 52;
    const participation = sessionsPerYear * values.participants;
    const engagementHours = sessionsPerYear * values.minutes / 60;
    const capacityHours = sessionsPerYear * values.adminMinutes / 60;
    const capacityValue = capacityHours * values.hourly;
    const annualBenefit = capacityValue - values.annual;
    const net = annualBenefit - values.upfront;
    const costs = values.annual + values.upfront;

    byId('tess-participation').textContent = number(participation);
    byId('tess-participation-detail').textContent = `${number(sessionsPerYear)} planned sessions per year.`;
    byId('tess-engagement').textContent = `${number(engagementHours)} hours`;
    byId('tess-capacity').textContent = `${number(capacityHours)} hours`;
    byId('tess-capacity-detail').textContent = capacityValue ? `${money(capacityValue)} potential annual capacity value.` : 'No capacity value entered.';
    byId('tess-net').textContent = costs > 0 ? money(net) : 'Add costs';
    byId('tess-return').textContent = costs > 0 ? `${number(net / costs * 100)}% first-year modelled ROI.` : 'Enter your quoted costs to calculate ROI and payback.';
    byId('tess-payback').textContent = values.upfront > 0 ? (annualBenefit > 0 ? `Simple payback: ${number(values.upfront / annualBenefit * 12)} months. Assumes benefits accrue evenly.` : 'No payback at these assumptions: annual net benefit is zero or negative.') : '';
  }

  form.addEventListener('input', calculate);
  form.addEventListener('reset', () => window.setTimeout(calculate, 0));
  byId('print-tess-roi').addEventListener('click', () => window.print());
  calculate();
})();
