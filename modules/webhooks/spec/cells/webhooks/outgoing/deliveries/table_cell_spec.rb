#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) 2012-2022 the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2013 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See COPYRIGHT and LICENSE files for more details.
#++
require 'spec_helper'

describe Webhooks::Outgoing::Deliveries::TableCell do
  include Cell::Testing

  # used internally by Cell::Testing when calling #cell helper
  let(:controller) { instance_double(ApplicationController, request: :dummy_request) }

  it 'escapes response body html' do
    delivery = create(:webhook_log, response_body: 'Hello <b>world<b/>!')
    html = cell(described_class, [delivery]).()

    response_body_node = Capybara.string(html).find('pre.webhooks--response-body')
    expect(response_body_node.text).to eq(delivery.response_body)
  end

  it 'escapes response headers html' do
    header_name = "x_header_<b>evil</b>_name"
    header_value = "header <b>evil</b> value"
    delivery = create(:webhook_log, response_headers: { header_name => header_value })
    html = cell(described_class, [delivery]).()

    response_headers_node = Capybara.string(html).find('pre.webhooks--response-headers')
    aggregate_failures do
      expect(response_headers_node).not_to have_selector('b', text: 'evil')
      expect(response_headers_node.text).to include(header_name)
      expect(response_headers_node.text).to include(header_value)
    end
  end
end
