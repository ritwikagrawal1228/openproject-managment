//-- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
//++

import {Injectable, Injector} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {catchError, map, tap} from 'rxjs/operators';
import {Observable} from 'rxjs';
import {HalResource, HalResourceClass} from 'core-app/modules/hal/resources/hal-resource';
import {CollectionResource} from 'core-app/modules/hal/resources/collection-resource';
import {HalLink, HalLinkInterface} from 'core-app/modules/hal/hal-link/hal-link';
import {ErrorObservable} from 'rxjs/observable/ErrorObservable';
import {initializeHalProperties} from 'core-app/modules/hal/helpers/hal-resource-builder';

export interface HalResourceFactoryConfigInterface {
  cls?:any;
  attrTypes?:{ [attrName:string]:string };
}


export type HTTPSupportedMethods = 'get'|'post'|'put'|'patch'|'delete';

@Injectable()
export class HalResourceService {

  /**
   * List of all known hal resources, extendable.
   */
  private config:{ [typeName:string]:HalResourceFactoryConfigInterface } = {};


  constructor(readonly injector:Injector,
              readonly http:HttpClient) {
  }

  /**
   * Perform a HTTP request and return a HalResource promise.
   */
  public request<T extends HalResource>(method:HTTPSupportedMethods, href:string, data?:any, headers:any = {}):Observable<T> {
    const config:any = {
      method: method,
      url: href,
      body: data || {},
      headers: headers,
      withCredentials: true,
      responseType: 'json'
    };

    return this.http.request<T>(method, href, config)
      .pipe(
        map((data:any) => this.createHalResource(data)),
        catchError((error:HttpErrorResponse) => {
          console.error(`Failed to ${method} ${href}: ${error.name}`);
          // return new ErrorObservable(this.createHalResource(error.error));
          return null as any;
        })
      ) as Observable<T>;
  }

  /**
   * Perform a GET request and return a resource promise.
   *
   * @param href
   * @param params
   * @param headers
   * @returns {Promise<HalResource>}
   */
  public get<T extends HalResource>(href:string, params?:any, headers?:any):Observable<T> {
    return this.request('get', href, params, headers);
  }

  /**
   * Return all potential pages to the request, when the elements returned from API is smaller
   * than the expected.
   *
   * @param href
   * @param expected The expected number of elements
   * @param params
   * @param headers
   * @return {Promise<CollectionResource[]>}
   */
  public async getAllPaginated<T extends HalResource[]>(href:string, expected:number, params:any = {}, headers:any = {}) {
    // Total number retrieved
    let retrieved = 0;
    // Current offset page
    let page = 1;
    // Accumulated results
    const allResults:CollectionResource[] = [];
    // If possible, request all at once.
    params.pageSize = expected;

    while (retrieved < expected) {
      params.offset = page;

      const promise = this.request<CollectionResource>('get', href, params, headers).toPromise();
      const results = await promise;

      if (results.count === 0) {
        throw 'No more results for this query, but expected more.';
      }

      allResults.push(results as CollectionResource);

      retrieved += results.count;
      page += 1;
    }

    return allResults;
  }

  /**
   * Perform a PUT request and return a resource promise.
   * @param href
   * @param data
   * @param headers
   * @returns {Promise<HalResource>}
   */
  public put<T extends HalResource>(href:string, data?:any, headers?:any):Observable<T> {
    return this.request('put', href, data, headers);
  }

  /**
   * Perform a POST request and return a resource promise.
   *
   * @param href
   * @param data
   * @param headers
   * @returns {Promise<HalResource>}
   */
  public post<T extends HalResource>(href:string, data?:any, headers?:any):Observable<T> {
    return this.request('post', href, data, headers);
  }

  /**
   * Perform a PATCH request and return a resource promise.
   *
   * @param href
   * @param data
   * @param headers
   * @returns {Promise<HalResource>}
   */
  public patch<T extends HalResource>(href:string, data?:any, headers?:any):Observable<T> {
    return this.request('patch', href, data, headers);
  }

  /**
   * Perform a DELETE request and return a resource promise
   *
   * @param href
   * @param data
   * @param headers
   * @returns {Promise<HalResource>}
   */
  public delete<T extends HalResource>(href:string, data?:any, headers?:any):Observable<T> {
    return this.request('delete', href, data, headers);
  }

  /**
   * Register a HalResource for use with the API.
   * @param {HalResourceStatic} resource
   */
  public registerResource(key:string, entry:HalResourceFactoryConfigInterface) {
    entry.cls._type = key;
    this.config[key] = entry;
  }

  /**
   * Get the default class.
   * Initially, it's HalResource.
   *
   * @returns {HalResource}
   */
  public get defaultClass():HalResourceClass<HalResource> {
    let defaultCls:HalResourceClass = HalResource;
    defaultCls._type = 'HalResource';
    return defaultCls;
  }

  /**
   * Create a HalResource from a source object.
   * If a _type attribute is defined and the type is configured, the
   * respective class will be used for instantiation.
   *
   * @param source
   * @returns {HalResource}
   */
  public createHalResource<T extends HalResource = HalResource>(source:any, loaded:boolean = true):T {
    if (_.isNil(source)) {
      source = HalResource.getEmptyResource();
    }

    const resourceClass = this.getResourceClassOfType<T>(source._type);
    return this.createHalResourceOfType<T>(resourceClass, source, loaded);
  }

  public createHalResourceOfType<T extends HalResource = HalResource>(resourceClass:HalResourceClass<T>, source:any, loaded:boolean = false) {
    const initializer = (halResource:T) => initializeHalProperties(this, halResource);
    return new resourceClass(this.injector, source, loaded, initializer);
  }

  /**
   * Create a linked HalResource from the given link.
   *
   * @param {HalLinkInterface} link
   * @returns {HalResource}
   */
  public fromLink(link:HalLinkInterface) {
    const resource = HalResource.getEmptyResource(HalLink.fromObject(this, link));
    return this.createHalResource(resource, false);
  }

  /**
   * Get a linked resource from its HalLink with the correct ype
   */
  public createLinkedResource(thisType:string, linkName:string, link:HalLinkInterface) {
    const source = HalResource.getEmptyResource();
    source._links.self = link;

    const resourceClass = this.getResourceClassOfAttribute(thisType, linkName);
    return this.createHalResourceOfType(resourceClass, source, false);
  }

  /**
   * Get the configured resource class of a type.
   *
   * @param type
   * @returns {HalResource}
   */
  protected getResourceClassOfType<T extends HalResource>(type:string):HalResourceClass<T> {
    const config = this.config[type];
    return (config && config.cls) ? config.cls : this.defaultClass;
  }

  /**
   * Get the resource class for an attribute.
   * Return the default class, if it does not exist.
   *
   * @param type
   * @param attribute
   * @returns {any}
   */
  protected getResourceClassOfAttribute<T extends HalResource = HalResource>(type:string, attribute:string):HalResourceClass<T>|HalResourceClass<HalResource> {
    const typeConfig = this.config[type];
    const types = (typeConfig && typeConfig.attrTypes) || {};
    const resourceRef = types[attribute];

    if (resourceRef) {
      return this.getResourceClassOfType(resourceRef);
    }

    return this.defaultClass;
  }
}
