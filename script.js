// Initialize data for country and region
let countryData = null;
let regionData = null;

document.addEventListener("DOMContentLoaded", function () {
  fetchDataAndPlot();
});

function getRegionData() {
  const regions = {};
  countryData.forEach((country) => {
    const region = country.region;
    if (region) {
      if (!regions[region]) {
        regions[region] = {
          countries: [],
          timezones: new Set(), // Use a Set to avoid duplicate timezones
        };
      }
      regions[region].countries.push(country.name);
      country.timezones.forEach((timezone) => {
        regions[region].timezones.add(timezone);
      });
    }
  });

  // Finalize the regions data structure
  const result = {};
  for (const [key, value] of Object.entries(regions)) {
    result[key] = {
      countries: value.countries,
      timezones: [...value.timezones], // Convert Set to array for timezones
    };
  }
  regionData = Object.entries(result).map(([region, details]) => ({
    region: region,
    countries: details.countries.length,
    timezones: details.timezones.length,
  }));
}

function fetchDataAndPlot() {
  if (!countryData) {
    d3.json("data/countries.json").then((data) => {
      countryData = data;
      getRegionData();
    });
  }
}

function updateForm(selectedGroupOption) {
  var form = d3.select("#select-option");
  form.selectAll("*").remove();

  if (selectedGroupOption === "country") {
    form
      .append("label")
      .attr("for", "select-option")
      .html("Select plot option: ");
    form
      .append("select")
      .attr("id", "select-option")
      .selectAll("option")
      .data([
        { value: "population", text: "Population Size" },
        { value: "borders", text: "Number of borders" },
        { value: "timezones", text: "Number of timezones" },
        { value: "languages", text: "Number of languages" },
      ])
      .enter()
      .append("option")
      .text((d) => d.text)
      .property("value", (d) => d.value);
  } else {
    form
      .append("label")
      .attr("for", "select-option")
      .html("Select plot option: ");
    form
      .append("select")
      .attr("id", "select-option")
      .selectAll("option")
      .data([
        {
          value: "countriesInRegion",
          text: "Number of countries in the region",
        },
        {
          value: "timezonesInRegion",
          text: "Number of unique timezones in the region",
        },
      ])
      .enter()
      .append("option")
      .text((d) => d.text)
      .property("value", (d) => d.value);
  }

  form.select("select").on("change", function () {
    const selectedOption = d3.select(this).property("value");
    drawChart(selectedOption, selectedGroupOption);
  });
}

d3.selectAll('input[name="group-option"]').on("change", function () {
  selectedGroupOption = d3
    .select('input[name="group-option"]:checked')
    .node().value;

  updateForm(selectedGroupOption);
  drawChart(
    selectedGroupOption === "country" ? "population" : "countriesInRegion",
    selectedGroupOption
  );
  drawTable(selectedGroupOption);
});

function drawChart(selectedOption, selectedGroupOption) {
  const data = selectedGroupOption === "country" ? countryData : regionData;
  const svgWidth = 800,
    svgHeight = 800; // Define SVG dimensions
  const svg = d3
    .select("#chart")
    .html("")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight); // Create SVG element

  let valueAccessor; // Function to access data values
  let radiusScale; // D3 scale for bubble sizes
  let maxValue; // Maximum value for data scaling
  let getFontSize; // Function to get font size based on bubble size
  let getDx; // Function to adjust text position
  let getName; // Function to get name based on sort type
  let d3Strength; // Strength of force simulation

  // Set parameters based on sort type
  if (selectedGroupOption === "country") {
    if (selectedOption === "population") {
      valueAccessor = (d) => +d[selectedOption];
      maxValue = d3.max(data, valueAccessor);
      radiusScale = d3.scaleSqrt().domain([0, maxValue]).range([5, 100]);
      getFontSize = (radius) => `${Math.max(1, radius / 3)}px`;
      getDx = (radius) => `-${Math.max(3.3, radius / 28)}em`;
    } else {
      valueAccessor = (d) =>
        Array.isArray(d[selectedOption]) ? d[selectedOption].length : 0;
      maxValue = d3.max(data, valueAccessor);
      radiusScale = d3.scaleSqrt().domain([0, maxValue]).range([5, 40]);
      getFontSize = (radius) => `${Math.max(1, radius / 3)}px`;
      getDx = (radius) => `-${Math.max(1.3, radius / 28)}em`;
    }
    getName = (d) => d.alpha3Code;
    d3Strength = 5;
  } else {
    if (selectedOption === "countriesInRegion") {
      valueAccessor = (d) => d.countries;
    } else {
      valueAccessor = (d) => d.timezones;
    }
    getName = (d) => d.region;
    maxValue = d3.max(data, valueAccessor);
    radiusScale = d3.scaleSqrt().domain([0, maxValue]).range([40, 100]);
    getFontSize = (radius) => `${Math.max(1, radius / 3)}px`;
    getDx = (radius) => `-${Math.max(2.4, radius / 45)}em`;
    d3Strength = 200;
  }

  // Process nodes for visualization
  const nodes = data.map((d) => ({
    value: valueAccessor(d),
    radius: radiusScale(valueAccessor(d)),
    name: getName(d),
    detail:
      selectedGroupOption === "country"
        ? {
            realName: d.name,
            capital: d.capital,
            region: d.region,
            population: d.population,
            nativeName: d.nativeName,
            borders: d.borders,
            languages: d.languages,
            timezones: d.timezones,
          }
        : { countries: d.countries, timezones: d.timezones },
    fontsize: getFontSize(radiusScale(valueAccessor(d))),
    dx: getDx(radiusScale(valueAccessor(d))),
    x: Math.random() * svgWidth,
    y: Math.random() * svgHeight,
  }));

  // Configure force simulation for bubble positioning
  const simulation = d3
    .forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(d3Strength))
    .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
    .force(
      "collision",
      d3.forceCollide().radius((d) => d.radius + 2)
    )
    .on("tick", ticked);

  // Define and configure tooltips for additional information on hover
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("padding", "10px")
    .style("background", "white")
    .style("border", "1px solid black")
    .style("pointer-events", "none");

  // Create bubbles and bind data
  const bubbles = svg
    .selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .attr("r", (d) => d.radius)
    .attr("fill", "black") // Default fill, consider updating to match desired visual
    .on("mouseover", function (event, d) {
      let tooltipContent;
      if (selectedGroupOption === "country") {
        tooltipContent = `Name: ${d.name}<br>Real Name: ${d.detail.realName}<br>Capital: ${d.detail.capital}<br>Region: ${d.detail.region}<br>Population: ${d.detail.population}<br>Native Name: ${d.detail.nativeName}`;
      } else {
        tooltipContent = `Region: ${d.name}<br>Countries: ${d.detail.countries}<br>Timezones: ${d.detail.timezones}`;
      }

      tooltip
        .html(tooltipContent)
        .style("visibility", "visible")
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("visibility", "hidden");
    });

  // Add labels to each bubble
  const labels = svg
    .selectAll("text")
    .data(nodes)
    .enter()
    .append("text")
    .text((d) => d.name)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("dominant-baseline", "middle")
    .attr("dy", "-1em")
    .style("font-size", (d) => d.fontsize)
    .style("pointer-events", "none");

  labels
    .append("tspan")
    .attr("dx", (d) => d.dx)
    .attr("dy", "1.2em")
    .style("font-size", (d) => d.fontsize)
    .text((d) => {
      return d.value; // Display value inside the bubble
    });

  // Function to adjust bubble positions on simulation tick
  function ticked() {
    bubbles.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    labels.attr("x", (d) => d.x).attr("y", (d) => d.y + d.radius / 4);
  }
}

function drawTable(selectedGroupOption) {
  const data = selectedGroupOption === "country" ? countryData : regionData;

  d3.select("table").remove();

  const table_container = d3.select("#table-container").append("div");

  const table = table_container.append("table").classed("table", true);

  const thead = table.append("thead").append("tr");
  const tbody = table.append("tbody");

  // Determine headers based on sort type
  let headers = [];
  if (selectedGroupOption === "country") {
    headers = [
      "Name",
      "Real Name",
      "Capital",
      "Region",
      "Population",
      "Borders",
      "Timezones",
      "Languages",
    ];
  } else {
    headers = ["Region", "Countries", "Timezones"];
  }
  thead
    .selectAll("th")
    .style("border", "1px solid #ddd")
    .data(headers)
    .enter()
    .append("th")
    .text((column) => column);

  const rows = tbody.selectAll("tr").data(data).enter().append("tr");

  if (selectedGroupOption === "country") {
    rows
      .selectAll("td")
      .style("border", "1px solid #ddd")
      .data((row) => [
        row.alpha3Code,
        row.name,
        row.capital,
        row.region,
        row.population,
        row.borders.join(", "),
        row.timezones.join(", "),
        row.languages
          .map((lang) => `${lang.name} (${lang.nativeName})`)
          .join(", "),
      ])
      .enter()
      .append("td")
      .text((d) => d);
  } else {
    rows
      .selectAll("td")
      .style("border", "1px solid #ddd")
      .data((row) => [row.region, row.countries, row.timezones])
      .enter()
      .append("td")
      .text((d) => d);
  }

  return table;
}
